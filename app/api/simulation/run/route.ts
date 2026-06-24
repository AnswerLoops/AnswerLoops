import { z } from 'zod'
import { generateText } from 'ai'
import { auth } from '@/auth'
import { getDb } from '@/lib/db/drizzle'
import { tickets, DEFAULT_ORG_ID } from '@/lib/db/schema'
import { desc, eq, and } from 'drizzle-orm'
import { chatModel } from '@/lib/ai/models'
import { assessAnswer, AUTO_DEFLECT_THRESHOLD } from '@/lib/ai/assess'
import { searchArticles } from '@/lib/db/queries/kb'
import { embedText } from '@/lib/ai/embed'
import { logger } from '@/lib/logger'

const MOD = 'api/simulation/run'

const Schema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(20),
  model: z.string().default('gpt-4o'),
  threshold: z.coerce.number().min(0).max(1).default(AUTO_DEFLECT_THRESHOLD),
})

export interface SimTicketResult {
  id: number
  content: string
  category: string | null
  actualStatus: string
  actualAiDraftStatus: string
  simAnswer: string
  simConfidence: number
  simAnsweredFully: boolean
  simReasoning: string
  simWouldDeflect: boolean
  actualWouldDeflect: boolean
  match: boolean
  durationMs: number
}

export interface SimulationResult {
  config: { count: number; model: string; threshold: number }
  results: SimTicketResult[]
  summary: {
    total: number
    wouldDeflect: number
    deflectRate: number
    actualDeflectRate: number
    matchRate: number
    avgConfidence: number
    avgDurationMs: number
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { body = {} }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const { count, model, threshold } = parsed.data
  const orgId = (session as { orgId?: number }).orgId ?? DEFAULT_ORG_ID

  const rows = await getDb()
    .select()
    .from(tickets)
    .where(and(eq(tickets.orgId, orgId)))
    .orderBy(desc(tickets.createdAt))
    .limit(count)

  if (rows.length === 0) {
    return Response.json({ error: 'No tickets found to simulate' }, { status: 404 })
  }

  const results: SimTicketResult[] = []

  for (const ticket of rows) {
    const t0 = Date.now()
    try {
      // Best-effort KB context — don't fail if embedding unavailable
      let kbContext = ''
      try {
        const vec = await embedText(ticket.content, orgId)
        const articles = await searchArticles(vec, 3, orgId)
        if (articles.length) {
          kbContext = `\n\nKnowledge base:\n${articles.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`
        }
      } catch { /* ignore */ }

      const { text: simAnswer } = await generateText({
        model: await chatModel(model, orgId),
        system: `You are a technical support agent. Answer the user's question concisely and accurately.${kbContext}`,
        prompt: ticket.content,
      })

      const assessment = await assessAnswer(ticket.content, simAnswer, orgId)
      const simWouldDeflect = assessment.confidence >= threshold && assessment.answered_fully
      const actualWouldDeflect = ticket.aiDraftStatus === 'posted'

      results.push({
        id: ticket.id,
        content: ticket.content.slice(0, 300),
        category: ticket.category,
        actualStatus: ticket.status,
        actualAiDraftStatus: ticket.aiDraftStatus,
        simAnswer: simAnswer.slice(0, 500),
        simConfidence: assessment.confidence,
        simAnsweredFully: assessment.answered_fully,
        simReasoning: assessment.reasoning,
        simWouldDeflect,
        actualWouldDeflect,
        match: simWouldDeflect === actualWouldDeflect,
        durationMs: Date.now() - t0,
      })
    } catch (err) {
      logger.error('simulation ticket failed', { module: MOD, ticketId: ticket.id, error: err })
      results.push({
        id: ticket.id,
        content: ticket.content.slice(0, 300),
        category: ticket.category,
        actualStatus: ticket.status,
        actualAiDraftStatus: ticket.aiDraftStatus,
        simAnswer: '[error]',
        simConfidence: 0,
        simAnsweredFully: false,
        simReasoning: 'Error during simulation',
        simWouldDeflect: false,
        actualWouldDeflect: ticket.aiDraftStatus === 'posted',
        match: false,
        durationMs: Date.now() - t0,
      })
    }
  }

  const wouldDeflect = results.filter(r => r.simWouldDeflect).length
  const actualDeflected = results.filter(r => r.actualWouldDeflect).length
  const matched = results.filter(r => r.match).length
  const avgConfidence = results.reduce((s, r) => s + r.simConfidence, 0) / results.length
  const avgDurationMs = results.reduce((s, r) => s + r.durationMs, 0) / results.length

  const response: SimulationResult = {
    config: { count, model, threshold },
    results,
    summary: {
      total: results.length,
      wouldDeflect,
      deflectRate: wouldDeflect / results.length,
      actualDeflectRate: actualDeflected / results.length,
      matchRate: matched / results.length,
      avgConfidence,
      avgDurationMs,
    },
  }

  logger.info('simulation complete', { module: MOD, orgId, total: results.length, matchRate: response.summary.matchRate })
  return Response.json(response)
}
