import { after } from 'next/server'
import { z } from 'zod'
import { triageMessage } from '@/lib/ai/triage'
import { createTicket, getTicketByDiscordMessageId } from '@/lib/db/queries/tickets'
import { createNotification } from '@/lib/db/queries/notifications'
import { calculateDeadlines, checkSlaBreaches } from '@/lib/sla/engine'
import { sendPushToAll } from '@/lib/push/notify'
import { runAIAgent } from '@/lib/ai/agent'
import { embedText, EMBEDDING_MODEL } from '@/lib/ai/embed'
import { findRelated, isDuplicate } from '@/lib/ai/related'
import { saveEmbedding, getCandidateVectors, replaceLinks, getPriorAnswers } from '@/lib/db/queries/embeddings'
import { getKBContext } from '@/lib/db/queries/kb'
import { getIntegrationByBotSecret } from '@/lib/db/queries/integrations'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import type { Priority } from '@/types'

const IngestSchema = z.object({
  message_id: z.string(),
  content: z.string().min(1),
  author_id: z.string(),
  author_name: z.string(),
  channel_id: z.string(),
  thread_id: z.string().optional(),
})

function severityToPriority(score: number): Priority {
  if (score >= 0.9) return 'critical'
  if (score >= 0.6) return 'high'
  if (score >= 0.3) return 'medium'
  return 'low'
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerSecret) return new Response('Unauthorized', { status: 401 })

  // Identify which org this request belongs to by looking up the bot_secret.
  // Fall back to the env-var secret → default org for backward compat.
  let orgId: number
  const integration = getIntegrationByBotSecret(bearerSecret)
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

  // Dedup
  const existing = getTicketByDiscordMessageId(message_id)
  if (existing) {
    return Response.json({ ok: true, ticket_id: existing.id, duplicate: true })
  }

  // AI triage
  const triage = await triageMessage(content)
  const priority = severityToPriority(triage.severity_score)
  const { sla_response_deadline, sla_resolve_deadline } = calculateDeadlines(priority)

  // Create ticket scoped to this org
  const ticket = createTicket({
    discord_message_id: message_id,
    discord_channel_id: channel_id,
    discord_thread_id: thread_id,
    discord_author_id: author_id,
    discord_author_name: author_name,
    content,
    category: triage.category,
    severity_score: triage.severity_score,
    ai_summary: triage.summary,
    ai_suggested_priority: triage.suggested_priority,
    priority,
    sla_response_deadline: sla_response_deadline ?? undefined,
    sla_resolve_deadline: sla_resolve_deadline ?? undefined,
  }, orgId)

  // In-app notification
  createNotification(
    'new_question',
    `New ${triage.category.replace('_', ' ')} from ${author_name}: ${triage.summary}`,
    ticket.id,
    orgId
  )

  // Background work: push notifications, SLA scan, semantic enrichment, AI agent
  after(async () => {
    await sendPushToAll({
      title: 'New Community Question',
      body: `${author_name}: ${triage.summary}`,
      url: `/tickets/${ticket.id}`,
    })

    checkSlaBreaches()

    let priorAnswers: { summary: string; answer: string }[] = []
    try {
      const vector = await embedText(`${triage.summary}\n\n${content}`)
      saveEmbedding(ticket.id, vector, EMBEDDING_MODEL)

      const related = findRelated(vector, getCandidateVectors(ticket.id))
      replaceLinks(ticket.id, related)

      const duplicates = related.filter((m) => isDuplicate(m.score))
      if (duplicates.length > 0) {
        createNotification(
          'new_question',
          `Possible duplicate (asked ${duplicates.length + 1}×): ${triage.summary}`,
          ticket.id,
          orgId
        )
      }

      priorAnswers = [...getKBContext(vector, 3, orgId), ...getPriorAnswers(related.map((m) => m.related_id), orgId)]
    } catch (err) {
      console.error('[ingest] semantic enrichment failed for ticket', ticket.id, err)
    }

    await runAIAgent(ticket.id, content, thread_id ?? channel_id, priorAnswers, orgId)
  })

  return Response.json({ ok: true, ticket_id: ticket.id })
}
