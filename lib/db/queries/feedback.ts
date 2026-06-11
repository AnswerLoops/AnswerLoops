import { eq, and } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { ticketFeedback, answerMessages, DEFAULT_ORG_ID } from '../schema'
import type { FeedbackSource, FeedbackSummary, FeedbackVote } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function saveFeedback(input: {
  ticketId: number
  source: FeedbackSource
  vote: FeedbackVote
  actor: string
}): void {
  dz()
    .insert(ticketFeedback)
    .values({
      ticketId: input.ticketId,
      source: input.source,
      vote: input.vote,
      actor: input.actor,
    })
    .onConflictDoUpdate({
      target: [ticketFeedback.ticketId, ticketFeedback.source, ticketFeedback.actor],
      set: { vote: input.vote, updatedAt: new Date().toISOString() },
    })
    .run()
}

export function getFeedbackSummary(ticketId: number): FeedbackSummary {
  const rows = raw()
    .prepare('SELECT vote FROM ticket_feedback WHERE ticket_id = ?')
    .all(ticketId) as { vote: FeedbackVote }[]

  const up = rows.filter((r) => r.vote === 'up').length
  const down = rows.filter((r) => r.vote === 'down').length

  const staff = raw()
    .prepare("SELECT vote FROM ticket_feedback WHERE ticket_id = ? AND source = 'staff' LIMIT 1")
    .get(ticketId) as { vote: FeedbackVote } | undefined

  return { up, down, staffVote: staff?.vote ?? null }
}

export function getTicketIdByAnswerMessage(discordMessageId: string): number | null {
  const row = raw()
    .prepare('SELECT ticket_id FROM answer_messages WHERE discord_message_id = ?')
    .get(discordMessageId) as { ticket_id: number } | undefined
  return row?.ticket_id ?? null
}

export function mapAnswerMessage(discordMessageId: string, ticketId: number): void {
  dz()
    .insert(answerMessages)
    .values({ discordMessageId, ticketId })
    .onConflictDoUpdate({
      target: answerMessages.discordMessageId,
      set: { ticketId },
    })
    .run()
}

export function getDeflectionAccuracyByCategory(orgId = DEFAULT_ORG_ID): {
  category: string
  deflected: number
  positive: number
  negative: number
}[] {
  return raw()
    .prepare(
      `SELECT t.category AS category,
              COUNT(*) AS deflected,
              SUM(CASE WHEN f.net > 0 THEN 1 ELSE 0 END) AS positive,
              SUM(CASE WHEN f.net < 0 THEN 1 ELSE 0 END) AS negative
       FROM ai_assessments a
       JOIN tickets t ON t.id = a.ticket_id
       LEFT JOIN (
         SELECT ticket_id,
                SUM(CASE WHEN vote = 'up' THEN 1 ELSE -1 END) AS net
         FROM ticket_feedback GROUP BY ticket_id
       ) f ON f.ticket_id = a.ticket_id
       WHERE a.auto_deflected = 1
         AND t.org_id = ?
       GROUP BY t.category`
    )
    .all(orgId) as { category: string; deflected: number; positive: number; negative: number }[]
}
