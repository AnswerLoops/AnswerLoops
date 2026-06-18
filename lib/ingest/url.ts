import FirecrawlApp from '@mendable/firecrawl-js'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'
import { createArticle } from '@/lib/db/queries/kb'

const MAX_CHUNK_CHARS = 1800
const MIN_CHUNK_CHARS = 60

interface Chunk {
  question: string
  answer: string
}

function chunkMarkdown(markdown: string, pageTitle: string): Chunk[] {
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

async function saveChunks(chunks: Chunk[], orgId: number): Promise<number> {
  let created = 0
  for (const chunk of chunks) {
    try {
      const embedding = await embedText(`${chunk.question}\n\n${chunk.answer}`)
      createArticle({ question: chunk.question, answer: chunk.answer, embedding, model: EMBEDDING_MODEL }, orgId)
      created++
    } catch {
      // skip failed chunks, continue with the rest
    }
  }
  return created
}

/** Scrape a single URL and save each heading section as a KB article. */
export async function ingestUrl(url: string, orgId: number): Promise<{ created: number }> {
  const app = makeClient()

  const result = await app.scrapeUrl(url, { formats: ['markdown'] })
  if (!('markdown' in result) || !result.markdown) {
    throw new Error(`Firecrawl scrape failed for ${url}`)
  }

  const title = (result as { metadata?: { title?: string } }).metadata?.title ?? url
  const chunks = chunkMarkdown(result.markdown, title)
  const created = await saveChunks(chunks, orgId)
  return { created }
}

/** Crawl an entire site (up to maxPages) and save all heading sections as KB articles. */
export async function ingestSite(
  url: string,
  orgId: number,
  maxPages = 25,
): Promise<{ created: number; pages: number }> {
  const app = makeClient()

  const crawlResult = await app.crawlUrl(url, {
    limit: maxPages,
    scrapeOptions: { formats: ['markdown'] },
  } as Parameters<typeof app.crawlUrl>[1])

  const pages = (crawlResult as { data?: unknown[] }).data ?? []
  let created = 0

  for (const page of pages as Array<{ markdown?: string; metadata?: { title?: string } }>) {
    if (!page.markdown) continue
    const title = page.metadata?.title ?? url
    const chunks = chunkMarkdown(page.markdown, title)
    created += await saveChunks(chunks, orgId)
  }

  return { created, pages: pages.length }
}
