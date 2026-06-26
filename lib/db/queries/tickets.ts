import { eq, and, inArray, sql, desc } from 'drizzle-orm'
import { getDb } from '../drizzle'
import {
  tickets,
  ticketReplies,
  ticketEvents,
  aiAssessments,
  DEFAULT_ORG_ID,
} from '../schema'
import type { Ticket, CreateTicketInput, TicketFilters, TicketReply, TicketEvent } from '@/types'

function toTicket(row: typeof tickets.$inferSelect): Ticket {
  return {
    id: row.id,
    discord_message_id: row.discordMessageId,
    discord_channel_id: row.discordChannelId,
    discord_thread_id: row.discordThreadId,
    discord_author_id: row.discordAuthorId,
    discord_author_name: row.discordAuthorName,
    content: row.content,
    category: row.category as Ticket['category'],
    severity_score: row.severityScore,
    ai_summary: row.aiSummary,
    ai_suggested_priority: row.aiSuggestedPriority as Ticket['ai_suggested_priority'],
    ai_draft: row.aiDraft,
    ai_draft_status: row.aiDraftStatus as Ticket['ai_draft_status'],
    ai_draft_posted_at: row.aiDraftPostedAt,
    priority: row.priority as Ticket['priority'],
    status: row.status as Ticket['status'],
    resolution_notes: row.resolutionNotes,
    sla_response_deadline: row.slaResponseDeadline,
    sla_resolve_deadline: row.slaResolveDeadline,
    sla_response_met: row.slaResponseMet as Ticket['sla_response_met'],
    sla_resolve_met: row.slaResolveMet as Ticket['sla_resolve_met'],
    first_response_at: row.firstResponseAt,
    resolved_at: row.resolvedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function toReply(row: typeof ticketReplies.$inferSelect): TicketReply {
  return {
    id: row.id,
    ticket_id: row.ticketId,
    staff_name: row.staffName,
    content: row.content,
    discord_msg_id: row.discordMsgId,
    created_at: row.createdAt,
  }
}

function toEvent(row: typeof ticketEvents.$inferSelect): TicketEvent {
  return {
    id: row.id,
    ticket_id: row.ticketId,
    event_type: row.eventType,
    old_value: row.oldValue,
    new_value: row.newValue,
    actor: row.actor,
    created_at: row.createdAt,
  }
}

export async function createTicket(input: CreateTicketInput, orgId = DEFAULT_ORG_ID): Promise<Ticket> {
  const db = getDb()
  const [row] = await db
    .insert(tickets)
    .values({
      orgId,
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
    })
    .returning()

  await db.insert(ticketEvents).values({ ticketId: row.id, eventType: 'created', actor: 'system' })

  return toTicket(row)
}

export async function getTickets(filters: TicketFilters = {}, orgId = DEFAULT_ORG_ID): Promise<Ticket[]> {
  const conditions = [eq(tickets.orgId, orgId)]
  if (filters.status) conditions.push(eq(tickets.status, filters.status))
  if (filters.priority) conditions.push(eq(tickets.priority, filters.priority))
  if (filters.category) conditions.push(eq(tickets.category, filters.category))

  const rows = await getDb()
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt))
  return rows.map(toTicket)
}

export async function getTicketById(id: number): Promise<Ticket | null> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)
  return row ? toTicket(row) : null
}

export async function getTicketByDiscordMessageId(messageId: string): Promise<Ticket | null> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(eq(tickets.discordMessageId, messageId))
    .limit(1)
  return row ? toTicket(row) : null
}

export async function updateTicketAIDraft(id: number, draft: string): Promise<void> {
  const now = new Date().toISOString()
  const db = getDb()
  await db
    .update(tickets)
    .set({ aiDraft: draft, aiDraftStatus: 'posted', aiDraftPostedAt: now, updatedAt: now })
    .where(eq(tickets.id, id))

  await db.insert(ticketEvents).values({
    ticketId: id,
    eventType: 'ai_draft_posted',
    newValue: 'posted',
    actor: 'system',
  })
}

export async function updateTicketAIDraftStatus(id: number, status: string, newDraft?: string): Promise<void> {
  await getDb()
    .update(tickets)
    .set({
      aiDraftStatus: status,
      ...(newDraft !== undefined ? { aiDraft: newDraft } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tickets.id, id))
}

export async function updateTicketStatus(
  id: number,
  status: string,
  actor: string,
  resolutionNotes?: string
): Promise<void> {
  const ticket = await getTicketById(id)
  if (!ticket) throw new Error('Ticket not found')

  const now = new Date().toISOString()
  const isFirstResponse = ticket.status === 'open' && status === 'in_progress'
  const isResolving = status === 'resolved' || status === 'closed'

  const update: Partial<typeof tickets.$inferInsert> = {
    status,
    updatedAt: now,
  }
  if (resolutionNotes) update.resolutionNotes = resolutionNotes
  if (isFirstResponse && !ticket.first_response_at) {
    update.firstResponseAt = now
    update.slaResponseMet =
      !ticket.sla_response_deadline || ticket.sla_response_deadline > now ? 1 : 0
  }
  if (isResolving) {
    update.resolvedAt = now
    update.slaResolveMet =
      !ticket.sla_resolve_deadline || ticket.sla_resolve_deadline > now ? 1 : 0
  }

  const db = getDb()
  await db.update(tickets).set(update).where(eq(tickets.id, id))
  await db.insert(ticketEvents).values({
    ticketId: id,
    eventType: 'status_changed',
    oldValue: ticket.status,
    newValue: status,
    actor,
  })
}

export async function addTicketReply(
  ticketId: number,
  staffName: string,
  content: string,
  discordMsgId?: string
): Promise<TicketReply> {
  const db = getDb()
  const [row] = await db
    .insert(ticketReplies)
    .values({ ticketId, staffName, content, discordMsgId: discordMsgId ?? null })
    .returning()

  const ticket = await getTicketById(ticketId)
  if (ticket && ticket.status === 'open') {
    await updateTicketStatus(ticketId, 'in_progress', staffName)
  }

  await db.insert(ticketEvents).values({
    ticketId,
    eventType: 'replied',
    newValue: content.slice(0, 100),
    actor: staffName,
  })

  return toReply(row)
}

export async function getTicketReplies(ticketId: number): Promise<TicketReply[]> {
  const rows = await getDb()
    .select()
    .from(ticketReplies)
    .where(eq(ticketReplies.ticketId, ticketId))
    .orderBy(ticketReplies.createdAt)
  return rows.map(toReply)
}

export async function getTicketEvents(ticketId: number): Promise<TicketEvent[]> {
  const rows = await getDb()
    .select()
    .from(ticketEvents)
    .where(eq(ticketEvents.ticketId, ticketId))
    .orderBy(ticketEvents.createdAt)
  return rows.map(toEvent)
}

export async function getTicketStats(orgId = DEFAULT_ORG_ID) {
  const db = getDb()

  const [totRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .where(eq(tickets.orgId, orgId))
  const [openRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.orgId, orgId), eq(tickets.status, 'open')))
  const [inProgressRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.orgId, orgId), eq(tickets.status, 'in_progress')))
  const [resolvedRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.orgId, orgId), inArray(tickets.status, ['resolved', 'closed'])))

  const [slaBreachRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM tickets
    WHERE (sla_response_met = 0 OR sla_resolve_met = 0) AND org_id = ${orgId}
  `)
  const [pendingRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .where(
      and(eq(tickets.orgId, orgId), eq(tickets.aiDraftStatus, 'pending'), eq(tickets.status, 'open'))
    )
  const [needsReviewRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM tickets t
    JOIN ai_assessments a ON a.ticket_id = t.id
    WHERE a.auto_deflected = 0 AND t.status = 'open' AND t.org_id = ${orgId}
  `)
  const [deflectedRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id
    WHERE a.auto_deflected = 1 AND t.org_id = ${orgId}
  `)

  return {
    total: totRow?.n ?? 0,
    open: openRow?.n ?? 0,
    inProgress: inProgressRow?.n ?? 0,
    resolved: resolvedRow?.n ?? 0,
    slaBreaches: Number((slaBreachRow as Record<string, unknown>).n ?? 0),
    pendingDrafts: pendingRow?.n ?? 0,
    needsReview: Number((needsReviewRow as Record<string, unknown>).n ?? 0),
    autoDeflected: Number((deflectedRow as Record<string, unknown>).n ?? 0),
  }
}

export async function getSLABreachedTickets(orgId = DEFAULT_ORG_ID): Promise<Ticket[]> {
  const rows = await getDb().execute(sql`
    SELECT * FROM tickets
    WHERE (sla_response_met = 0 OR sla_resolve_met = 0)
      AND status NOT IN ('resolved', 'closed')
      AND org_id = ${orgId}
    ORDER BY created_at ASC
  `)
  return (rows as Record<string, unknown>[]).map((r) => r as unknown as Ticket)
}

export async function deleteTicket(id: number): Promise<void> {
  const db = await getDb()
  await db.delete(ticketReplies).where(eq(ticketReplies.ticketId, id))
  await db.delete(ticketEvents).where(eq(ticketEvents.ticketId, id))
  await db.delete(aiAssessments).where(eq(aiAssessments.ticketId, id))
  await db.delete(tickets).where(eq(tickets.id, id))
}
