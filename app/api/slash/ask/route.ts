import { z } from 'zod'
import { generateText } from 'ai'
import { getIntegrationByBotSecret } from '@/lib/db/queries/integrations'
import { searchArticles } from '@/lib/db/queries/kb'
import { embedText } from '@/lib/ai/embed'
import { chatModel, DEFAULT_CHAT_MODEL } from '@/lib/ai/models'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

const MOD = 'api/slash/ask'

const Schema = z.object({
  question: z.string().min(5).max(1000),
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

  const { question } = parsed.data

  // Embed question → KB semantic search for context
  let kbContext = ''
  try {
    const vector = await embedText(question, orgId)
    const kbResults = await searchArticles(vector, 3, orgId)
    if (kbResults.length) {
      kbContext = `\n\nKnowledge base:\n${kbResults.map((a) => `Q: "${a.question}"\nA: ${a.answer}`).join('\n\n')}`
    }
  } catch {
    // KB context is best-effort — answer without it if embedding fails
  }

  try {
    const { text } = await generateText({
      model: await chatModel(DEFAULT_CHAT_MODEL, orgId),
      system: `You are a helpful support assistant for a Discord community.
Answer concisely in markdown. Respond in the same language as the question.
If you cite a KB article, reference the question it answered. If you don't know, say so honestly.${kbContext}`,
      prompt: question,
    })

    logger.info('slash /ask answered', { module: MOD, orgId })
    return Response.json({ answer: text })
  } catch (err) {
    logger.error('slash /ask AI failed', { module: MOD, error: err })
    return Response.json({ error: 'AI failed to generate an answer' }, { status: 500 })
  }
}
