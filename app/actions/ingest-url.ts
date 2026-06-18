'use server'

import { z } from 'zod'
import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { ingestUrl, ingestSite } from '@/lib/ingest/url'

const Schema = z.object({
  url: z.string().url('Must be a valid URL'),
  mode: z.enum(['page', 'site']),
})

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
    return { error: String(err) }
  }
}
