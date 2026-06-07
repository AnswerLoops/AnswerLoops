import { getDb } from '../index'
import type { FeedbackSource, FeedbackSummary, FeedbackVote } from '@/types'

/**
 * Record a 👍/👎 on a ticket's AI answer. One vote per (ticket, source, actor);
 * re-voting (e.g. switching 👍→👎) overwrites the previous vote.
 */
export function saveFeedback(input: {
  ticketId: number
  source: FeedbackSource
  vote: FeedbackVote
  actor: string
}): void {
  getDb().prepare(`
    INSERT INTO ticket_feedback (ticket_id, source, vote, actor)
    VALUES (@ticket_id, @source, @vote, @actor)
    ON CONFLICT(ticket_id, source, actor) DO UPDATE SET
      vote = excluded.vote,
      updated_at = datetime('now')
  `).run({
    ticket_id: input.ticketId,
    source: input.source,
    vote: input.vote,
    actor: input.actor,
  })
}

/** Up/down tallies for a ticket, plus the current staff vote (if any). */
export function getFeedbackSummary(ticketId: number): FeedbackSummary {
  const rows = getDb()
    .prepare('SELECT vote FROM ticket_feedback WHERE ticket_id = ?')
    .all(ticketId) as { vote: FeedbackVote }[]

  const up = rows.filter((r) => r.vote === 'up').length
  const down = rows.filter((r) => r.vote === 'down').length

  const staff = getDb()
    .prepare("SELECT vote FROM ticket_feedback WHERE ticket_id = ? AND source = 'staff' LIMIT 1")
    .get(ticketId) as { vote: FeedbackVote } | undefined

  return { up, down, staffVote: staff?.vote ?? null }
}

/** Resolve the ticket a posted AI answer message belongs to. */
export function getTicketIdByAnswerMessage(discordMessageId: string): number | null {
  const row = getDb()
    .prepare('SELECT ticket_id FROM answer_messages WHERE discord_message_id = ?')
    .get(discordMessageId) as { ticket_id: number } | undefined
  return row?.ticket_id ?? null
}

/** Remember which ticket a posted AI answer message belongs to. */
export function mapAnswerMessage(discordMessageId: string, ticketId: number): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO answer_messages (discord_message_id, ticket_id)
    VALUES (?, ?)
  `).run(discordMessageId, ticketId)
}

/**
 * Per-category auto-deflect accuracy: of the answers we auto-answered, how many
 * earned net-positive vs net-negative community feedback. Drives confidence in
 * the threshold and feeds the analytics surface.
 */
export function getDeflectionAccuracyByCategory(): {
  category: string
  deflected: number
  positive: number
  negative: number
}[] {
  return getDb().prepare(`
    SELECT t.category AS category,
           COUNT(*) AS deflected,
           SUM(CASE WHEN f.net > 0 THEN 1 ELSE 0 END) AS positive,
           SUM(CASE WHEN f.net < 0 THEN 1 ELSE 0 END) AS negative
    FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id
    LEFT JOIN (
      SELECT ticket_id,
             SUM(CASE WHEN vote = 'up' THEN 1 ELSE -1 END) AS net
      FROM ticket_feedback
      GROUP BY ticket_id
    ) f ON f.ticket_id = a.ticket_id
    WHERE a.auto_deflected = 1
    GROUP BY t.category
  `).all() as { category: string; deflected: number; positive: number; negative: number }[]
}
