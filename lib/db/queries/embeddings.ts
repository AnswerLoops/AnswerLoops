import { eq, ne } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { ticketEmbeddings, DEFAULT_ORG_ID } from '../schema'
import type { Candidate, Match } from '@/lib/ai/related'
import type { PriorAnswer, RelatedTicket } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function saveEmbedding(ticketId: number, vector: number[], model: string): void {
  dz()
    .insert(ticketEmbeddings)
    .values({ ticketId, vector: JSON.stringify(vector), model })
    .onConflictDoUpdate({
      target: ticketEmbeddings.ticketId,
      set: { vector: JSON.stringify(vector), model },
    })
    .run()
}

export function getCandidateVectors(excludeTicketId: number): Candidate[] {
  const rows = raw()
    .prepare('SELECT ticket_id, vector FROM ticket_embeddings WHERE ticket_id != ?')
    .all(excludeTicketId) as { ticket_id: number; vector: string }[]
  return rows.map((r) => ({ ticket_id: r.ticket_id, vector: JSON.parse(r.vector) as number[] }))
}

export function replaceLinks(ticketId: number, matches: Match[]): void {
  const db = raw()
  const tx = db.transaction((id: number, ms: Match[]) => {
    db.prepare('DELETE FROM ticket_links WHERE ticket_id = ?').run(id)
    const insert = db.prepare(
      'INSERT OR REPLACE INTO ticket_links (ticket_id, related_id, score) VALUES (?, ?, ?)'
    )
    for (const m of ms) insert.run(id, m.related_id, m.score)
  })
  tx(ticketId, matches)
}

export function getRelatedTickets(ticketId: number): RelatedTicket[] {
  return raw()
    .prepare(
      `SELECT t.id,
              COALESCE(t.ai_summary, substr(t.content, 1, 120)) AS summary,
              t.category, t.status, l.score, t.created_at
       FROM ticket_links l
       JOIN tickets t ON t.id = l.related_id
       WHERE l.ticket_id = ?
       ORDER BY l.score DESC`
    )
    .all(ticketId) as RelatedTicket[]
}

export function getPriorAnswers(ticketIds: number[], orgId = DEFAULT_ORG_ID): PriorAnswer[] {
  if (ticketIds.length === 0) return []
  const placeholders = ticketIds.map(() => '?').join(',')
  return raw()
    .prepare(
      `SELECT COALESCE(t.ai_summary, substr(t.content, 1, 120)) AS summary,
              COALESCE(t.resolution_notes, t.ai_draft) AS answer
       FROM tickets t
       LEFT JOIN (
         SELECT ticket_id,
                SUM(CASE WHEN vote = 'up' THEN 1 ELSE -1 END) AS net
         FROM ticket_feedback GROUP BY ticket_id
       ) f ON f.ticket_id = t.id
       WHERE t.id IN (${placeholders})
         AND t.org_id = ?
         AND t.status IN ('resolved', 'closed')
         AND COALESCE(t.resolution_notes, t.ai_draft) IS NOT NULL
         AND COALESCE(f.net, 0) >= 0
       ORDER BY COALESCE(f.net, 0) DESC`
    )
    .all(...ticketIds, orgId) as PriorAnswer[]
}
