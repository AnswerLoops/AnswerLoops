import { streamText, convertToModelMessages } from 'ai'
import type { UIMessage } from 'ai'
import { chatModel, DEFAULT_FAST_MODEL } from '@/lib/ai/models'
import { embedText } from '@/lib/ai/embed'
import { getKBContext } from '@/lib/db/queries/kb'
import { getPriorAnswers, getCandidateVectors } from '@/lib/db/queries/embeddings'
import { findRelated } from '@/lib/ai/related'
import { getOrgByWidgetToken } from '@/lib/db/queries/widgets'
import { rateLimit } from '@/lib/ratelimit'

// Per-IP+token: catches a single abusive visitor. Per-token: caps total cost
// exposure for one org even if the IP rotates (proxies, mobile networks, botnets).
const IP_TOKEN_MAX = 20
const IP_TOKEN_WINDOW_MS = 60_000
const TOKEN_MAX = 100
const TOKEN_WINDOW_MS = 60_000

// Each message is capped well above normal chat length; the whole array is
// capped so a caller can't send thousands of messages to inflate model cost.
const MAX_MESSAGE_CHARS = 4_000
const MAX_MESSAGES = 50

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  let body: { messages?: unknown[]; widgetToken?: string }
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { messages, widgetToken } = body
  if (!widgetToken || typeof widgetToken !== 'string') {
    return new Response('Missing widgetToken', { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Missing messages', { status: 400 })
  }
  if (messages.length > MAX_MESSAGES) {
    return new Response('Too many messages', { status: 400 })
  }

  const tokenLimit = rateLimit(`widget-token:${widgetToken}`, TOKEN_MAX, TOKEN_WINDOW_MS)
  if (!tokenLimit.ok) {
    return new Response('Too many requests', { status: 429 })
  }
  const ipLimit = rateLimit(`widget-ip:${widgetToken}:${ip}`, IP_TOKEN_MAX, IP_TOKEN_WINDOW_MS)
  if (!ipLimit.ok) {
    return new Response('Too many requests', { status: 429 })
  }

  const org = await getOrgByWidgetToken(widgetToken)
  if (!org) {
    return new Response('Invalid widget token', { status: 404 })
  }

  const uiMessages = messages as UIMessage[]
  const oversized = uiMessages.some((m) =>
    m.parts?.some((p) => p.type === 'text' && (p as { text: string }).text.length > MAX_MESSAGE_CHARS)
  )
  if (oversized) {
    return new Response('Message too long', { status: 400 })
  }

  // AI SDK v6: UIMessage[] → ModelMessage[] via official converter
  const modelMessages = await convertToModelMessages(uiMessages)

  if (modelMessages.length === 0) {
    return new Response('No valid messages', { status: 400 })
  }

  // Extract last user text for KB context lookup
  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === 'user')
  const query = lastUserMsg?.parts
    ?.filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('') ?? ''

  let kbContext: { summary: string; answer: string }[] = []
  let priorContext: { summary: string; answer: string }[] = []

  if (query.trim()) {
    try {
      const vector = await embedText(query, org.id)
      kbContext = await getKBContext(vector, 4, org.id)
      const related = findRelated(vector, await getCandidateVectors(0, org.id))
      priorContext = await getPriorAnswers(related.map((r) => r.related_id), org.id)
    } catch {
      // Proceed without context if embedding fails
    }
  }

  const allContext = [...kbContext, ...priorContext].slice(0, 5)
  const contextBlock = allContext.length
    ? `\n\nKnowledge base context — use this to answer. When your answer draws from one of these, end your response with a "Source:" line citing the article title:\n${allContext
        .map((c, i) => `${i + 1}. Title: "${c.summary}"\n   Answer: ${c.answer}`)
        .join('\n')}`
    : ''

  const result = streamText({
    model: await chatModel(DEFAULT_FAST_MODEL, org.id),
    system: `You are a helpful support assistant for ${org.name}.
Answer questions concisely and accurately based on the knowledge base context provided.
If you don't know the answer or it's not covered in the context, say so honestly and suggest the user contact support directly.
Keep responses brief and friendly. Format with markdown when helpful.
Respond in the same language as the user's question — if they write in Spanish, reply in Spanish; French, reply in French; etc.
When citing a knowledge base article, end your response with: 📚 *Source: [article title]*${contextBlock}`,
    messages: modelMessages,
    maxOutputTokens: 600,
  })

  return result.toUIMessageStreamResponse()
}
