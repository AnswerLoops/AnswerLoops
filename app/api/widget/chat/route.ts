import { streamText } from 'ai'
import { chatModel } from '@/lib/ai/models'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'
import { getKBContext } from '@/lib/db/queries/kb'
import { getPriorAnswers, getCandidateVectors } from '@/lib/db/queries/embeddings'
import { findRelated } from '@/lib/ai/related'
import { getOrgByWidgetToken } from '@/lib/db/queries/widgets'

// Simple in-memory rate limit: max 20 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.reset < now) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return new Response('Too many requests', { status: 429 })
  }

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

  const org = getOrgByWidgetToken(widgetToken)
  if (!org) {
    return new Response('Invalid widget token', { status: 404 })
  }

  // Get the last user message to build context
  const lastUser = [...messages].reverse().find((m: unknown) => (m as { role: string }).role === 'user') as { role: string; content: string } | undefined
  const query = lastUser?.content ?? ''

  let kbContext: { summary: string; answer: string }[] = []
  let priorContext: { summary: string; answer: string }[] = []

  if (query.trim()) {
    try {
      const vector = await embedText(query)
      kbContext = getKBContext(vector, 4, org.id)
      const related = findRelated(vector, getCandidateVectors(0))
      priorContext = getPriorAnswers(related.map((r) => r.related_id), org.id)
    } catch {
      // Proceed without context if embedding fails
    }
  }

  const allContext = [...kbContext, ...priorContext].slice(0, 5)
  const contextBlock = allContext.length
    ? `\n\nKnowledge base context (use this to answer):\n${allContext
        .map((c, i) => `${i + 1}. Q: ${c.summary}\n   A: ${c.answer}`)
        .join('\n')}`
    : ''

  const result = streamText({
    model: chatModel('gpt-4o-mini'),
    system: `You are a helpful support assistant for ${org.name}.
Answer questions concisely and accurately based on the knowledge base context provided.
If you don't know the answer or it's not covered in the context, say so honestly and suggest the user contact support directly.
Keep responses brief and friendly. Format with markdown when helpful.${contextBlock}`,
    messages: messages as NonNullable<Parameters<typeof streamText>[0]['messages']>,
    maxOutputTokens: 600,
  })

  return result.toUIMessageStreamResponse()
}
