import { eq, and, inArray, sql, desc } from 'drizzle-orm'
import { getDb } from '../drizzle'
import {
  tickets,
  ticketReplies,
  ticketEvents,
  aiAssessments,
} from '../schema'
import type { Ticket, CreateTicketInput, TicketFilters, TicketReply, TicketEvent } from '@/types'

function toTicket(row: typeof tickets.$inferSelect): Ticket {
  return {
    id: row.id,
    discord_message_id: row.discordMessageId,
    discord_guild_id: row.discordGuildId,
    discord_channel_id: row.discordChannelId,
    discord_thread_id: row.discordThreadId,
    discord_author_id: row.discordAuthorId,
    discord_author_name: row.discordAuthorName,
    discord_deleted_at: row.discordDeletedAt ?? null,
    source_platform: (row.sourcePlatform ?? 'discord') as Ticket['source_platform'],
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

export async function createTicket(input: CreateTicketInput, orgId: number): Promise<Ticket> {
  const db = getDb()
  const [row] = await db
    .insert(tickets)
    .values({
      orgId,
      discordMessageId: input.discord_message_id ?? null,
      discordGuildId: input.discord_guild_id ?? null,
      discordChannelId: input.discord_channel_id ?? null,
      discordThreadId: input.discord_thread_id ?? null,
      discordAuthorId: input.discord_author_id ?? null,
      discordAuthorName: input.discord_author_name ?? null,
      sourcePlatform: input.source_platform ?? 'discord',
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

export async function getTickets(filters: TicketFilters = {}, orgId: number, limit?: number): Promise<Ticket[]> {
  const conditions = [eq(tickets.orgId, orgId)]
  if (filters.status) conditions.push(eq(tickets.status, filters.status))
  if (filters.priority) conditions.push(eq(tickets.priority, filters.priority))
  if (filters.category) conditions.push(eq(tickets.category, filters.category))

  let query = getDb()
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt))
    .$dynamic()
  if (limit) query = query.limit(limit)

  const rows = await query
  return rows.map(toTicket)
}

export async function getTicketById(id: number, orgId: number): Promise<Ticket | null> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.orgId, orgId)))
    .limit(1)
  return row ? toTicket(row) : null
}

// Internal helper for mutations that run after the caller has already verified
// org ownership (or that run in trusted system paths like the ingest pipeline).
async function getTicketByIdUnscoped(id: number): Promise<Ticket | null> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)
  return row ? toTicket(row) : null
}

export async function getTicketByDiscordMessageId(messageId: string, orgId: number): Promise<Ticket | null> {
  const [row] = await getDb()
    .select()
    .from(tickets)
    .where(and(eq(tickets.discordMessageId, messageId), eq(tickets.orgId, orgId)))
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
  const ticket = await getTicketByIdUnscoped(id)
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

  const ticket = await getTicketByIdUnscoped(ticketId)
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

export async function getTicketStats(orgId: number) {
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

export async function getSLABreachedTickets(orgId: number): Promise<Ticket[]> {
  const rows = await getDb().execute(sql`
    SELECT * FROM tickets
    WHERE (sla_response_met = 0 OR sla_resolve_met = 0)
      AND status NOT IN ('resolved', 'closed')
      AND org_id = ${orgId}
    ORDER BY created_at ASC
  `)
  return (rows as Record<string, unknown>[]).map((r) => r as unknown as Ticket)
}

export async function markDiscordDeleted(discordMessageId: string): Promise<void> {
  await getDb()
    .update(tickets)
    .set({ discordDeletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(tickets.discordMessageId, discordMessageId))
}

export async function markThreadDiscordDeleted(threadId: string): Promise<void> {
  await getDb()
    .update(tickets)
    .set({ discordDeletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(tickets.discordThreadId, threadId))
}

/**
 * Record an inbound customer email reply as a follow-up on an existing ticket.
 * Reopens the ticket if it was resolved/closed — a reply means the issue
 * isn't actually done. System path (webhook ingest), so unscoped by design.
 */
export async function recordCustomerReply(ticketId: number, content: string): Promise<void> {
  const ticket = await getTicketByIdUnscoped(ticketId)
  if (!ticket) throw new Error('Ticket not found')

  const now = new Date().toISOString()
  const wasClosed = ticket.status === 'resolved' || ticket.status === 'closed'
  const db = getDb()

  if (wasClosed) {
    await db
      .update(tickets)
      .set({ status: 'open', updatedAt: now })
      .where(eq(tickets.id, ticketId))
  } else {
    await db.update(tickets).set({ updatedAt: now }).where(eq(tickets.id, ticketId))
  }

  await db.insert(ticketEvents).values({
    ticketId,
    eventType: 'customer_reply',
    oldValue: wasClosed ? ticket.status : null,
    newValue: wasClosed ? 'open' : null,
    actor: 'customer',
  })

  await db.insert(ticketReplies).values({
    ticketId,
    staffName: 'Customer',
    content,
  })
}

export async function deleteTicket(id: number): Promise<void> {
  const db = await getDb()
  await db.delete(ticketReplies).where(eq(ticketReplies.ticketId, id))
  await db.delete(ticketEvents).where(eq(ticketEvents.ticketId, id))
  await db.delete(aiAssessments).where(eq(aiAssessments.ticketId, id))
  await db.delete(tickets).where(eq(tickets.id, id))
}
