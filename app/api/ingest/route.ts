import { after } from 'next/server'
import { z } from 'zod'
import { triageMessage } from '@/lib/ai/triage'
import { createTicket, getTicketByDiscordMessageId } from '@/lib/db/queries/tickets'
import { createNotification } from '@/lib/db/queries/notifications'
import { calculateDeadlines, checkSlaBreaches } from '@/lib/sla/engine'
import { sendPushToAll } from '@/lib/push/notify'
import { runAIAgent } from '@/lib/ai/agent'
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
  // Verify internal bot secret
  const auth = request.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.BOT_SECRET}`) {
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

  // Create ticket
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
  })

  // In-app notification
  createNotification(
    'new_question',
    `New ${triage.category.replace('_', ' ')} from ${author_name}: ${triage.summary}`,
    ticket.id
  )

  // Background work: push notifications, SLA scan, AI agent
  after(async () => {
    await sendPushToAll({
      title: 'New Community Question',
      body: `${author_name}: ${triage.summary}`,
      url: `/tickets/${ticket.id}`,
    })

    checkSlaBreaches()

    // Run AI agent to generate answer from GitHub source code
    await runAIAgent(ticket.id, content, thread_id ?? channel_id)
  })

  return Response.json({ ok: true, ticket_id: ticket.id })
}
