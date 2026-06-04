import { getDb } from '@/lib/db'
import { getSLAConfig } from '@/lib/db/queries/sla'
import type { Priority } from '@/types'

export function calculateDeadlines(priority: Priority, createdAt: Date = new Date()) {
  const config = getSLAConfig(priority)
  if (!config) {
    return { sla_response_deadline: null, sla_resolve_deadline: null }
  }

  const responseDeadline = new Date(createdAt.getTime() + config.response_hours * 3_600_000)
  const resolveDeadline = new Date(createdAt.getTime() + config.resolve_hours * 3_600_000)

  return {
    sla_response_deadline: responseDeadline.toISOString(),
    sla_resolve_deadline: resolveDeadline.toISOString(),
  }
}

export function checkSlaBreaches(): number[] {
  const db = getDb()
  const now = new Date().toISOString()

  // Mark response SLA breaches: open tickets past response deadline with no response
  db.prepare(`
    UPDATE tickets
    SET sla_response_met = 0, updated_at = datetime('now')
    WHERE status = 'open'
      AND sla_response_deadline IS NOT NULL
      AND sla_response_deadline < ?
      AND sla_response_met IS NULL
  `).run(now)

  // Mark resolve SLA breaches: unresolved tickets past resolve deadline
  db.prepare(`
    UPDATE tickets
    SET sla_resolve_met = 0, updated_at = datetime('now')
    WHERE status NOT IN ('resolved', 'closed')
      AND sla_resolve_deadline IS NOT NULL
      AND sla_resolve_deadline < ?
      AND sla_resolve_met IS NULL
  `).run(now)

  // Return IDs of tickets that just got marked as breached (updated in last minute)
  const breached = db.prepare(`
    SELECT id FROM tickets
    WHERE (sla_response_met = 0 OR sla_resolve_met = 0)
      AND updated_at > datetime('now', '-1 minute')
  `).all() as { id: number }[]

  return breached.map((r) => r.id)
}

export function getSLAStatus(ticket: {
  sla_response_deadline: string | null
  sla_resolve_deadline: string | null
  sla_response_met: 0 | 1 | null
  sla_resolve_met: 0 | 1 | null
  status: string
}) {
  const now = new Date()

  const responseBreached =
    ticket.sla_response_met === 0 ||
    (ticket.sla_response_met === null &&
      ticket.sla_response_deadline !== null &&
      new Date(ticket.sla_response_deadline) < now &&
      ticket.status === 'open')

  const resolveBreached =
    ticket.sla_resolve_met === 0 ||
    (ticket.sla_resolve_met === null &&
      ticket.sla_resolve_deadline !== null &&
      new Date(ticket.sla_resolve_deadline) < now &&
      !['resolved', 'closed'].includes(ticket.status))

  const responseDeadlineMs =
    ticket.sla_response_deadline ? new Date(ticket.sla_response_deadline).getTime() - now.getTime() : null

  const resolveDeadlineMs =
    ticket.sla_resolve_deadline ? new Date(ticket.sla_resolve_deadline).getTime() - now.getTime() : null

  return {
    responseBreached,
    resolveBreached,
    anyBreached: responseBreached || resolveBreached,
    responseRemainingMs: responseDeadlineMs,
    resolveRemainingMs: resolveDeadlineMs,
  }
}
