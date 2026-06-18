'use server'

import { z } from 'zod'
import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { ingestUrl, ingestSite, IngestLimitError } from '@/lib/ingest/url'
import { rateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

const Schema = z.object({
  url: z.string().url('Must be a valid URL').max(2048, 'URL is too long'),
  mode: z.enum(['page', 'site']),
})

// Bound how often a workspace can trigger crawls (each one costs Firecrawl +
// embedding calls). 10 imports per 10 minutes per org.
const IMPORT_MAX = 10
const IMPORT_WINDOW_MS = 10 * 60_000

export interface IngestUrlResult {
  error?: string
  created?: number
  pages?: number
}

export async function ingestUrlAction(
  _prevState: unknown,
  formData: FormData,
): Promise<IngestUrlResult> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  if (!process.env.FIRECRAWL_API_KEY) {
    return { error: 'FIRECRAWL_API_KEY is not configured. Add it to your .env file.' }
  }

  const limit = rateLimit(`ingest:${orgId}`, IMPORT_MAX, IMPORT_WINDOW_MS)
  if (!limit.ok) {
    const mins = Math.ceil(limit.retryAfterMs / 60_000)
    return { error: `Import rate limit reached. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` }
  }

  const parsed = Schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { url, mode } = parsed.data

  try {
    if (mode === 'site') {
      const result = await ingestSite(url, orgId)
      return { created: result.created, pages: result.pages }
    } else {
      const result = await ingestUrl(url, orgId)
      return { created: result.created }
    }
  } catch (err) {
    // Surface cap messages verbatim; keep other errors generic.
    if (err instanceof IngestLimitError) return { error: err.message }
    logger.error('ingest-url failed', { module: 'actions/ingest-url', error: err })
    return { error: 'Import failed. Check the URL and try again.' }
  }
}
