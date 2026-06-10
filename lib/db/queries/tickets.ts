import { eq, and } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import {
  tickets,
  ticketReplies,
  ticketEvents,
  DEFAULT_ORG_ID,
} from '../schema'
import type { Ticket, CreateTicketInput, TicketFilters, TicketReply, TicketEvent } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function createTicket(input: CreateTicketInput): Ticket {
  const result = dz().insert(tickets).values({
    orgId: DEFAULT_ORG_ID,
    discordMessageId: input.discord_message_id ?? null,
    discordChannelId: input.discord_channel_id ?? null,
    discordThreadId: input.discord_thread_id ?? null,
    discordAuthorId: input.discord_author_id ?? null,
    discordAuthorName: input.discord_author_name ?? null,
    content: input.content,
    category: input.category ?? null,
    severityScore: input.severity_score ?? null,
    aiSummary: input.ai_summary ?? null,
    aiSuggestedPriority: input.ai_suggested_priority ?? null,
    priority: input.priority,
    slaResponseDeadline: input.sla_response_deadline ?? null,
    slaResolveDeadline: input.sla_resolve_deadline ?? null,
  }).run()

  const id = Number(result.lastInsertRowid)

  dz().insert(ticketEvents).values({ ticketId: id, eventType: 'created', actor: 'system' }).run()

  return getTicketById(id)!
}

export function getTickets(filters: TicketFilters = {}, orgId = DEFAULT_ORG_ID): Ticket[] {
  const conditions: string[] = ['org_id = @org_id']
  const params: Record<string, string | number> = { org_id: orgId }

  if (filters.status) { conditions.push('status = @status'); params.status = filters.status }
  if (filters.priority) { conditions.push('priority = @priority'); params.priority = filters.priority }
  if (filters.category) { conditions.push('category = @category'); params.category = filters.category }

  return raw()
    .prepare(`SELECT * FROM tickets WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`)
    .all(params) as Ticket[]
}

export function getTicketById(id: number): Ticket | null {
  return (raw().prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket) ?? null
}

export function getTicketByDiscordMessageId(messageId: string): Ticket | null {
  return (raw().prepare('SELECT * FROM tickets WHERE discord_message_id = ?').get(messageId) as Ticket) ?? null
}

export function updateTicketAIDraft(id: number, draft: string): void {
  dz()
    .update(tickets)
    .set({
      aiDraft: draft,
      aiDraftStatus: 'posted',
      aiDraftPostedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tickets.id, id))
    .run()

  dz().insert(ticketEvents).values({
    ticketId: id,
    eventType: 'ai_draft_posted',
    newValue: 'posted',
    actor: 'system',
  }).run()
}

export function updateTicketAIDraftStatus(id: number, status: string, newDraft?: string): void {
  dz()
    .update(tickets)
    .set({
      aiDraftStatus: status,
      ...(newDraft !== undefined ? { aiDraft: newDraft } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tickets.id, id))
    .run()
}

export function updateTicketStatus(
  id: number,
  status: string,
  actor: string,
  resolutionNotes?: string
): void {
  const ticket = getTicketById(id)
  if (!ticket) throw new Error('Ticket not found')

  const now = new Date().toISOString()
  const isFirstResponse = ticket.status === 'open' && status === 'in_progress'
  const isResolving = status === 'resolved' || status === 'closed'

  raw()
    .prepare(
      `UPDATE tickets SET
        status = ?,
        resolution_notes = COALESCE(?, resolution_notes),
        first_response_at = CASE WHEN ? = 1 AND first_response_at IS NULL THEN ? ELSE first_response_at END,
        sla_response_met = CASE WHEN ? = 1 AND sla_response_met IS NULL THEN
          CASE WHEN sla_response_deadline IS NULL OR sla_response_deadline > ? THEN 1 ELSE 0 END
          ELSE sla_response_met END,
        resolved_at = CASE WHEN ? = 1 THEN ? ELSE resolved_at END,
        sla_resolve_met = CASE WHEN ? = 1 THEN
          CASE WHEN sla_resolve_deadline IS NULL OR sla_resolve_deadline > ? THEN 1 ELSE 0 END
          ELSE sla_resolve_met END,
        updated_at = ?
      WHERE id = ?`
    )
    .run(
      status,
      resolutionNotes ?? null,
      isFirstResponse ? 1 : 0, now,
      isFirstResponse ? 1 : 0, now,
      isResolving ? 1 : 0, now,
      isResolving ? 1 : 0, now,
      now,
      id
    )

  dz().insert(ticketEvents).values({
    ticketId: id,
    eventType: 'status_changed',
    oldValue: ticket.status,
    newValue: status,
    actor,
  }).run()
}

export function addTicketReply(ticketId: number, staffName: string, content: string, discordMsgId?: string): TicketReply {
  const result = dz().insert(ticketReplies).values({
    ticketId,
    staffName,
    content,
    discordMsgId: discordMsgId ?? null,
  }).run()

  const ticket = getTicketById(ticketId)
  if (ticket && ticket.status === 'open') {
    updateTicketStatus(ticketId, 'in_progress', staffName)
  }

  dz().insert(ticketEvents).values({
    ticketId,
    eventType: 'replied',
    newValue: content.slice(0, 100),
    actor: staffName,
  }).run()

  return raw()
    .prepare('SELECT * FROM ticket_replies WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as TicketReply
}

export function getTicketReplies(ticketId: number): TicketReply[] {
  return raw()
    .prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticketId) as TicketReply[]
}

export function getTicketEvents(ticketId: number): TicketEvent[] {
  return raw()
    .prepare('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticketId) as TicketEvent[]
}

export function getTicketStats(orgId = DEFAULT_ORG_ID) {
  const db = raw()
  const total = (db.prepare('SELECT COUNT(*) as n FROM tickets WHERE org_id = ?').get(orgId) as { n: number }).n
  const open = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE status = 'open' AND org_id = ?").get(orgId) as { n: number }).n
  const inProgress = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE status = 'in_progress' AND org_id = ?").get(orgId) as { n: number }).n
  const resolved = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE status IN ('resolved','closed') AND org_id = ?").get(orgId) as { n: number }).n
  const slaBreaches = (db.prepare('SELECT COUNT(*) as n FROM tickets WHERE (sla_response_met = 0 OR sla_resolve_met = 0) AND org_id = ?').get(orgId) as { n: number }).n
  const pendingDrafts = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE ai_draft_status = 'pending' AND status = 'open' AND org_id = ?").get(orgId) as { n: number }).n
  const needsReview = (db.prepare(`
    SELECT COUNT(*) as n FROM tickets t
    JOIN ai_assessments a ON a.ticket_id = t.id
    WHERE a.auto_deflected = 0 AND t.status = 'open' AND t.org_id = ?
  `).get(orgId) as { n: number }).n
  const autoDeflected = (db.prepare(`
    SELECT COUNT(*) as n FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id
    WHERE a.auto_deflected = 1 AND t.org_id = ?
  `).get(orgId) as { n: number }).n

  return { total, open, inProgress, resolved, slaBreaches, pendingDrafts, needsReview, autoDeflected }
}

export function getSLABreachedTickets(orgId = DEFAULT_ORG_ID): Ticket[] {
  return raw()
    .prepare(
      `SELECT * FROM tickets
       WHERE (sla_response_met = 0 OR sla_resolve_met = 0)
         AND status NOT IN ('resolved', 'closed')
         AND org_id = ?
       ORDER BY created_at ASC`
    )
    .all(orgId) as Ticket[]
}
