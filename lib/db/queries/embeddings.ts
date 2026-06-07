import { getDb } from '../index'
import type { Candidate, Match } from '@/lib/ai/related'
import type { PriorAnswer, RelatedTicket } from '@/types'

/** Store (or replace) the embedding vector for a ticket. */
export function saveEmbedding(ticketId: number, vector: number[], model: string): void {
  getDb().prepare(`
    INSERT INTO ticket_embeddings (ticket_id, vector, model)
    VALUES (?, ?, ?)
    ON CONFLICT(ticket_id) DO UPDATE SET vector = excluded.vector, model = excluded.model
  `).run(ticketId, JSON.stringify(vector), model)
}

/** All stored embeddings except the given ticket, ready for similarity search. */
export function getCandidateVectors(excludeTicketId: number): Candidate[] {
  const rows = getDb()
    .prepare('SELECT ticket_id, vector FROM ticket_embeddings WHERE ticket_id != ?')
    .all(excludeTicketId) as { ticket_id: number; vector: string }[]
  return rows.map((r) => ({ ticket_id: r.ticket_id, vector: JSON.parse(r.vector) as number[] }))
}

/** Replace the stored neighbour links for a ticket. */
export function replaceLinks(ticketId: number, matches: Match[]): void {
  const db = getDb()
  const tx = db.transaction((id: number, ms: Match[]) => {
    db.prepare('DELETE FROM ticket_links WHERE ticket_id = ?').run(id)
    const insert = db.prepare(
      'INSERT OR REPLACE INTO ticket_links (ticket_id, related_id, score) VALUES (?, ?, ?)'
    )
    for (const m of ms) insert.run(id, m.related_id, m.score)
  })
  tx(ticketId, matches)
}

/** Related tickets for display: joins links to ticket metadata, newest score first. */
export function getRelatedTickets(ticketId: number): RelatedTicket[] {
  return getDb().prepare(`
    SELECT t.id,
           COALESCE(t.ai_summary, substr(t.content, 1, 120)) AS summary,
           t.category,
           t.status,
           l.score,
           t.created_at
    FROM ticket_links l
    JOIN tickets t ON t.id = l.related_id
    WHERE l.ticket_id = ?
    ORDER BY l.score DESC
  `).all(ticketId) as RelatedTicket[]
}

/**
 * Resolved prior answers among the given ticket ids — used to ground the AI
 * agent in what the team already answered. Falls back to the AI draft when no
 * human resolution note exists.
 *
 * Feedback loop: answers whose ticket earned net-negative feedback (more 👎
 * than 👍) are dropped so the agent stops reusing answers the community
 * rejected; best-rated answers are surfaced first.
 */
export function getPriorAnswers(ticketIds: number[]): PriorAnswer[] {
  if (ticketIds.length === 0) return []
  const placeholders = ticketIds.map(() => '?').join(',')
  const rows = getDb().prepare(`
    SELECT COALESCE(t.ai_summary, substr(t.content, 1, 120)) AS summary,
           COALESCE(t.resolution_notes, t.ai_draft) AS answer
    FROM tickets t
    LEFT JOIN (
      SELECT ticket_id,
             SUM(CASE WHEN vote = 'up' THEN 1 ELSE -1 END) AS net
      FROM ticket_feedback
      GROUP BY ticket_id
    ) f ON f.ticket_id = t.id
    WHERE t.id IN (${placeholders})
      AND t.status IN ('resolved', 'closed')
      AND COALESCE(t.resolution_notes, t.ai_draft) IS NOT NULL
      AND COALESCE(f.net, 0) >= 0
    ORDER BY COALESCE(f.net, 0) DESC
  `).all(...ticketIds) as PriorAnswer[]
  return rows
}
