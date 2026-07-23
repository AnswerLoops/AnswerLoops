import { z } from 'zod'
import { generateText } from 'ai'
import { getIntegrationByBotSecret } from '@/lib/db/queries/integrations'
import { chatModel, DEFAULT_CHAT_MODEL } from '@/lib/ai/models'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

const MOD = 'api/slash/summarize'

const Schema = z.object({
  messages: z.array(z.string().max(2000)).min(1).max(50),
  channel_id: z.string(),
})

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerSecret) return new Response('Unauthorized', { status: 401 })

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
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const { messages } = parsed.data
  const transcript = messages.join('\n')

  try {
    const { text } = await generateText({
      model: await chatModel(DEFAULT_CHAT_MODEL, orgId),
      system: `You are summarizing a Discord channel conversation for support staff.
Output a tight bullet-point summary in markdown:
- What was asked or discussed
- Key decisions or answers given
- Any open questions or unresolved issues
Keep it under 400 words. Respond in the same language as the conversation.`,
      prompt: `Summarize this conversation:\n\n${transcript}`,
    })

    logger.info('slash /summarize done', { module: MOD, orgId, messageCount: messages.length })
    return Response.json({ summary: text })
  } catch (err) {
    logger.error('slash /summarize AI failed', { module: MOD, error: err })
    return Response.json({ error: 'AI failed to summarize' }, { status: 500 })
  }
}
