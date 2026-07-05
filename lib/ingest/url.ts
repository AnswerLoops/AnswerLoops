import FirecrawlApp from '@mendable/firecrawl-js'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'
import { createArticle, createArticleFromSource, countArticles } from '@/lib/db/queries/kb'
import { createKBSource, getKBSourceByFilename, updateKBSourceChunkCount } from '@/lib/db/queries/kb-sources'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'

const MAX_CHUNK_CHARS = 1800
const MIN_CHUNK_CHARS = 60

// Cost / abuse caps. Each saved chunk costs an embedding call, so bound the
// work per import and the total KB size per org.
const MAX_PAGES = 25                  // hard ceiling on crawl breadth
const MAX_CHUNKS_PER_IMPORT = 150     // bounds embeddings per import
const MAX_TOTAL_CHARS = 600_000       // bounds total text embedded per import
const MAX_ARTICLES_PER_ORG = 2000     // KB size ceiling per workspace

export class IngestLimitError extends Error {}

interface Chunk {
  question: string
  answer: string
}

export function chunkMarkdown(markdown: string, pageTitle: string): Chunk[] {
  // Split on h2/h3 headings; each section = one KB article
  const sections = markdown.split(/\n(?=#{2,3} )/)
  const chunks: Chunk[] = []

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const heading = lines[0].replace(/^#+\s*/, '').trim()
    const body = lines.slice(1).join('\n').trim()

    if (body.length < MIN_CHUNK_CHARS) continue

    // If a section is very long, split on double-newline paragraphs
    if (body.length > MAX_CHUNK_CHARS) {
      const paras = body.split(/\n{2,}/)
      let current = ''
      for (const para of paras) {
        if ((current + para).length > MAX_CHUNK_CHARS && current) {
          chunks.push({ question: heading || pageTitle, answer: current.trim() })
          current = para
        } else {
          current = current ? `${current}\n\n${para}` : para
        }
      }
      if (current.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push({ question: heading || pageTitle, answer: current.trim() })
      }
    } else {
      chunks.push({ question: heading || pageTitle, answer: body })
    }
  }

  // Fallback: no headings → whole page as one chunk
  if (chunks.length === 0 && markdown.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push({
      question: pageTitle,
      answer: markdown.trim().slice(0, MAX_CHUNK_CHARS),
    })
  }

  return chunks
}

function makeClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set')
  const apiUrl = process.env.FIRECRAWL_API_URL // optional: point to self-hosted instance
  return new FirecrawlApp({ apiKey, ...(apiUrl ? { apiUrl } : {}) })
}

// Trim an accumulated chunk list to the per-import caps (count + total chars).
function applyImportCaps(chunks: Chunk[]): Chunk[] {
  const capped: Chunk[] = []
  let totalChars = 0
  for (const chunk of chunks) {
    if (capped.length >= MAX_CHUNKS_PER_IMPORT) break
    const len = chunk.question.length + chunk.answer.length
    if (totalChars + len > MAX_TOTAL_CHARS) break
    totalChars += len
    capped.push(chunk)
  }
  return capped
}

// Embed and persist chunks, enforcing the per-org article ceiling.
// When sourceId is provided, articles are linked to that kb_sources row.
async function saveChunks(chunks: Chunk[], orgId: number, sourceId?: number): Promise<number> {
  const existing = await countArticles(orgId)
  if (existing >= MAX_ARTICLES_PER_ORG) {
    throw new IngestLimitError(
      `Knowledge base is full (${MAX_ARTICLES_PER_ORG} articles). Delete some before importing more.`,
    )
  }
  const remaining = MAX_ARTICLES_PER_ORG - existing
  const budgeted = applyImportCaps(chunks).slice(0, remaining)

  let created = 0
  let lastError: unknown
  for (const chunk of budgeted) {
    try {
      const embedding = await embedText(`${chunk.question}\n\n${chunk.answer}`)
      if (sourceId != null) {
        await createArticleFromSource(
          { question: chunk.question, answer: chunk.answer, embedding, model: EMBEDDING_MODEL, sourceId },
          orgId,
        )
      } else {
        await createArticle({ question: chunk.question, answer: chunk.answer, embedding, model: EMBEDDING_MODEL }, orgId)
      }
      created++
    } catch (err) {
      lastError = err
    }
  }
  if (created === 0 && lastError) throw lastError
  return created
}

/** Scrape a single URL and save each heading section as a KB article. */
export async function ingestUrl(url: string, orgId: number): Promise<{ created: number; skipped?: boolean }> {
  if (MOCK_EXTERNALS) {
    const mockMd = `## Mock Page\n\nThis is mock content for ${url}. It contains enough text to be chunked into a KB article for testing purposes.`
    const existing = await getKBSourceByFilename(orgId, url)
    if (existing) return { created: 0, skipped: true }
    const source = await createKBSource({ orgId, filename: url, fileType: 'url', sizeBytes: mockMd.length })
    const chunks = chunkMarkdown(mockMd, 'Mock Page')
    const created = await saveChunks(chunks, orgId, source.id)
    await updateKBSourceChunkCount(source.id, created)
    return { created }
  }

  // Skip if already ingested
  const existing = await getKBSourceByFilename(orgId, url)
  if (existing) return { created: 0, skipped: true }

  const app = makeClient()

  const result = await app.scrapeUrl(url, { formats: ['markdown'] })
  if (!('markdown' in result) || !result.markdown) {
    throw new Error(`Firecrawl scrape failed for ${url}`)
  }

  const source = await createKBSource({
    orgId,
    filename: url,
    fileType: 'url',
    sizeBytes: result.markdown.length,
  })

  const title = (result as { metadata?: { title?: string } }).metadata?.title ?? url
  const chunks = chunkMarkdown(result.markdown, title)
  const created = await saveChunks(chunks, orgId, source.id)
  await updateKBSourceChunkCount(source.id, created)
  return { created }
}

/** Crawl an entire site (up to MAX_PAGES) and save all heading sections as KB articles.
 *  Pages already ingested (by URL) are skipped — safe to re-run to pick up new pages. */
export async function ingestSite(
  url: string,
  orgId: number,
  maxPages = MAX_PAGES,
): Promise<{ created: number; pages: number; skipped: number }> {
  if (MOCK_EXTERNALS) {
    const mockMd = `## Mock Site Page\n\nThis is mock site content for ${url}. It contains enough text to be chunked into a KB article for testing purposes. The site crawl returns multiple pages.`
    const existing = await getKBSourceByFilename(orgId, url)
    if (existing) return { created: 0, pages: 1, skipped: 1 }
    const source = await createKBSource({ orgId, filename: url, fileType: 'url', sizeBytes: mockMd.length })
    const chunks = chunkMarkdown(mockMd, 'Mock Site Page')
    const created = await saveChunks(chunks, orgId, source.id)
    await updateKBSourceChunkCount(source.id, created)
    return { created, pages: 1, skipped: 0 }
  }

  const app = makeClient()

  const crawlResult = await app.crawlUrl(url, {
    limit: Math.min(maxPages, MAX_PAGES),
    scrapeOptions: { formats: ['markdown'] },
  } as Parameters<typeof app.crawlUrl>[1])

  const pages = (crawlResult as { data?: unknown[] }).data ?? []

  let created = 0
  let skipped = 0

  for (const page of pages as Array<{ markdown?: string; metadata?: { title?: string; sourceURL?: string } }>) {
    if (!page.markdown) continue

    const pageUrl = page.metadata?.sourceURL ?? url
    const existing = await getKBSourceByFilename(orgId, pageUrl)
    if (existing) {
      skipped++
      continue
    }

    const source = await createKBSource({
      orgId,
      filename: pageUrl,
      fileType: 'url',
      sizeBytes: page.markdown.length,
    })

    const title = page.metadata?.title ?? pageUrl
    const chunks = chunkMarkdown(page.markdown, title)
    const pageCreated = await saveChunks(chunks, orgId, source.id)
    await updateKBSourceChunkCount(source.id, pageCreated)
    created += pageCreated
  }

  return { created, pages: pages.length, skipped }
}
