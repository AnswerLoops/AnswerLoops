import { getDb } from '../index'
import type { Ticket, CreateTicketInput, TicketFilters, TicketReply, TicketEvent } from '@/types'

export function createTicket(input: CreateTicketInput): Ticket {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO tickets (
      discord_message_id, discord_channel_id, discord_thread_id,
      discord_author_id, discord_author_name, content,
      category, severity_score, ai_summary, ai_suggested_priority,
      priority, sla_response_deadline, sla_resolve_deadline
    ) VALUES (
      @discord_message_id, @discord_channel_id, @discord_thread_id,
      @discord_author_id, @discord_author_name, @content,
      @category, @severity_score, @ai_summary, @ai_suggested_priority,
      @priority, @sla_response_deadline, @sla_resolve_deadline
    )
  `).run({
    discord_message_id: input.discord_message_id ?? null,
    discord_channel_id: input.discord_channel_id ?? null,
    discord_thread_id: input.discord_thread_id ?? null,
    discord_author_id: input.discord_author_id ?? null,
    discord_author_name: input.discord_author_name ?? null,
    content: input.content,
    category: input.category ?? null,
    severity_score: input.severity_score ?? null,
    ai_summary: input.ai_summary ?? null,
    ai_suggested_priority: input.ai_suggested_priority ?? null,
    priority: input.priority,
    sla_response_deadline: input.sla_response_deadline ?? null,
    sla_resolve_deadline: input.sla_resolve_deadline ?? null,
  })

  db.prepare(`
    INSERT INTO ticket_events (ticket_id, event_type, actor)
    VALUES (?, 'created', 'system')
  `).run(result.lastInsertRowid)

  return getTicketById(result.lastInsertRowid as number)!
}

export function getTickets(filters: TicketFilters = {}): Ticket[] {
  const db = getDb()
  const conditions: string[] = []
  const params: Record<string, string> = {}

  if (filters.status) {
    conditions.push('status = @status')
    params.status = filters.status
  }
  if (filters.priority) {
    conditions.push('priority = @priority')
    params.priority = filters.priority
  }
  if (filters.category) {
    conditions.push('category = @category')
    params.category = filters.category
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM tickets ${where} ORDER BY created_at DESC`).all(params) as Ticket[]
}

export function getTicketById(id: number): Ticket | null {
  return (getDb().prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket) ?? null
}

export function getTicketByDiscordMessageId(messageId: string): Ticket | null {
  return (getDb().prepare('SELECT * FROM tickets WHERE discord_message_id = ?').get(messageId) as Ticket) ?? null
}

export function updateTicketAIDraft(id: number, draft: string): void {
  getDb().prepare(`
    UPDATE tickets
    SET ai_draft = ?, ai_draft_status = 'posted', ai_draft_posted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(draft, id)

  getDb().prepare(`
    INSERT INTO ticket_events (ticket_id, event_type, new_value, actor)
    VALUES (?, 'ai_draft_posted', 'posted', 'system')
  `).run(id)
}

export function updateTicketAIDraftStatus(id: number, status: string, newDraft?: string): void {
  if (newDraft !== undefined) {
    getDb().prepare(`
      UPDATE tickets SET ai_draft = ?, ai_draft_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newDraft, status, id)
  } else {
    getDb().prepare(`
      UPDATE tickets SET ai_draft_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id)
  }
}

export function updateTicketStatus(
  id: number,
  status: string,
  actor: string,
  resolutionNotes?: string
): void {
  const db = getDb()
  const ticket = getTicketById(id)
  if (!ticket) throw new Error('Ticket not found')

  const now = new Date().toISOString()
  const isFirstResponse = ticket.status === 'open' && status === 'in_progress'
  const isResolving = status === 'resolved' || status === 'closed'

  db.prepare(`
    UPDATE tickets SET
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
    WHERE id = ?
  `).run(
    status,
    resolutionNotes ?? null,
    isFirstResponse ? 1 : 0, now,
    isFirstResponse ? 1 : 0, now,
    isResolving ? 1 : 0, now,
    isResolving ? 1 : 0, now,
    now,
    id
  )

  db.prepare(`
    INSERT INTO ticket_events (ticket_id, event_type, old_value, new_value, actor)
    VALUES (?, 'status_changed', ?, ?, ?)
  `).run(id, ticket.status, status, actor)
}

export function addTicketReply(ticketId: number, staffName: string, content: string, discordMsgId?: string): TicketReply {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO ticket_replies (ticket_id, staff_name, content, discord_msg_id)
    VALUES (?, ?, ?, ?)
  `).run(ticketId, staffName, content, discordMsgId ?? null)

  // Mark first response SLA
  const ticket = getTicketById(ticketId)
  if (ticket && ticket.status === 'open') {
    updateTicketStatus(ticketId, 'in_progress', staffName)
  }

  db.prepare(`
    INSERT INTO ticket_events (ticket_id, event_type, new_value, actor)
    VALUES (?, 'replied', ?, ?)
  `).run(ticketId, content.slice(0, 100), staffName)

  return db.prepare('SELECT * FROM ticket_replies WHERE id = ?').get(result.lastInsertRowid) as TicketReply
}

export function getTicketReplies(ticketId: number): TicketReply[] {
  return getDb().prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as TicketReply[]
}

export function getTicketEvents(ticketId: number): TicketEvent[] {
  return getDb().prepare('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as TicketEvent[]
}

export function getTicketStats() {
  const db = getDb()
  const total = (db.prepare('SELECT COUNT(*) as n FROM tickets').get() as { n: number }).n
  const open = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE status = 'open'").get() as { n: number }).n
  const inProgress = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE status = 'in_progress'").get() as { n: number }).n
  const resolved = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE status IN ('resolved','closed')").get() as { n: number }).n
  const slaBreaches = (db.prepare('SELECT COUNT(*) as n FROM tickets WHERE sla_response_met = 0 OR sla_resolve_met = 0').get() as { n: number }).n
  const pendingDrafts = (db.prepare("SELECT COUNT(*) as n FROM tickets WHERE ai_draft_status = 'pending' AND status = 'open'").get() as { n: number }).n
  const needsReview = (db.prepare(`
    SELECT COUNT(*) as n FROM tickets t
    JOIN ai_assessments a ON a.ticket_id = t.id
    WHERE a.auto_deflected = 0 AND t.status = 'open'
  `).get() as { n: number }).n
  const autoDeflected = (db.prepare('SELECT COUNT(*) as n FROM ai_assessments WHERE auto_deflected = 1').get() as { n: number }).n

  return { total, open, inProgress, resolved, slaBreaches, pendingDrafts, needsReview, autoDeflected }
}

export function getSLABreachedTickets(): Ticket[] {
  return getDb().prepare(`
    SELECT * FROM tickets
    WHERE (sla_response_met = 0 OR sla_resolve_met = 0)
      AND status NOT IN ('resolved', 'closed')
    ORDER BY created_at ASC
  `).all() as Ticket[]
}
