import { getInstallationOctokit } from './app'
import { chunkMarkdown } from '@/lib/ingest/url'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'
import { createArticleFromSource, countArticles } from '@/lib/db/queries/kb'
import { createKBSource, getKBSourceByFilename, deleteKBSource, updateKBSourceChunkCount } from '@/lib/db/queries/kb-sources'
import { updateRepoSettings } from '@/lib/db/queries/github'
import { logger } from '@/lib/logger'

const MOD = 'github/kb-sync'
const MAX_FILES = 100
const MAX_ARTICLES_PER_ORG = 2000

const EXCLUDE_PATHS = ['node_modules', 'vendor', '.github', 'test', 'tests', '__tests__', 'spec']
const EXCLUDE_FILES = ['CHANGELOG.md', 'CHANGELOG.mdx', 'LICENSE.md', 'CODE_OF_CONDUCT.md']

function shouldInclude(path: string): boolean {
  const lower = path.toLowerCase()
  if (!lower.endsWith('.md') && !lower.endsWith('.mdx')) return false
  for (const excl of EXCLUDE_PATHS) {
    if (lower.includes(`/${excl}/`) || lower.startsWith(`${excl}/`)) return false
  }
  const filename = path.split('/').pop() ?? ''
  if (EXCLUDE_FILES.includes(filename)) return false
  return true
}

export async function syncRepoToKB(
  repoId: number,
  owner: string,
  repo: string,
  installationId: number,
  orgId: number
): Promise<number> {
  const octokit = await getInstallationOctokit(owner, repo)

  // Get full file tree
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: 'HEAD',
    recursive: '1',
  })

  const mdFiles = (tree.tree ?? [])
    .filter((f) => f.type === 'blob' && f.path && shouldInclude(f.path))
    .slice(0, MAX_FILES)

  logger.info('github kb sync started', { module: MOD, owner, repo, fileCount: mdFiles.length })

  // Delete existing source for this repo to avoid duplicate chunks on re-sync
  const sourceFilename = `${owner}/${repo}`
  const existing = await getKBSourceByFilename(orgId, sourceFilename)
  if (existing) {
    await deleteKBSource(existing.id, orgId)
  }

  const currentCount = await countArticles(orgId)
  const budget = Math.max(0, MAX_ARTICLES_PER_ORG - currentCount)
  if (budget === 0) {
    logger.warn('kb full — skipping github sync', { module: MOD, orgId })
    return 0
  }

  const source = await createKBSource({
    orgId,
    filename: sourceFilename,
    fileType: 'github',
    sizeBytes: 0,
  })

  let created = 0

  for (const file of mdFiles) {
    if (created >= budget) break
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path: file.path! })
      if (Array.isArray(data) || data.type !== 'file') continue

      const content = Buffer.from(data.content, 'base64').toString('utf8')
      const chunks = chunkMarkdown(content, file.path!.replace(/\.[^.]+$/, ''))

      for (const chunk of chunks) {
        if (created >= budget) break
        try {
          const embedding = await embedText(`${chunk.question}\n\n${chunk.answer}`)
          await createArticleFromSource({ question: chunk.question, answer: chunk.answer, embedding, model: EMBEDDING_MODEL, sourceId: source.id }, orgId)
          created++
        } catch (err) {
          logger.warn('chunk embed failed', { module: MOD, path: file.path, error: err })
        }
      }
    } catch (err) {
      logger.warn('file fetch failed', { module: MOD, path: file.path, error: err })
    }
  }

  await updateKBSourceChunkCount(source.id, created)
  await updateRepoSettings(repoId, orgId, {
    kbLastSynced: new Date().toISOString(),
    kbChunkCount: created,
  })

  logger.info('github kb sync done', { module: MOD, owner, repo, created })
  return created
}
