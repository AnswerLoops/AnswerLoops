import { z } from 'zod'
import { getIntegrationByBotSecret } from '@/lib/db/queries/integrations'
import { processCommunityMessage } from '@/lib/ingest/pipeline'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const IngestSchema = z.object({
  message_id: z.string(),
  content: z.string().min(1),
  author_id: z.string(),
  author_name: z.string(),
  channel_id: z.string(),
  thread_id: z.string().optional(),
})

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerSecret) return new Response('Unauthorized', { status: 401 })

  // Identify org by bot_secret from integrations; fall back to env var for compat.
  let orgId: number
  const integration = await getIntegrationByBotSecret(bearerSecret)
  if (integration) {
    orgId = integration.org_id
  } else if (process.env.BOT_SECRET && bearerSecret === process.env.BOT_SECRET) {
    orgId = DEFAULT_ORG_ID
  } else {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = IngestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { message_id, content, author_id, author_name, channel_id, thread_id } = parsed.data

  const result = await processCommunityMessage({
    messageId: message_id,
    content,
    authorId: author_id,
    authorName: author_name,
    channelId: channel_id,
    threadId: thread_id,
    platform: 'discord',
  }, orgId)

  return Response.json({ ok: true, ...result })
}
