import { randomUUID } from 'crypto'
import type { APIRequestContext } from '@playwright/test'
import { getDb } from '../lib/db/index'
import type { AIAssessment } from '../types'

export const BOT_SECRET = 'test-bot-secret'
export const BOT_AUTH = { Authorization: `Bearer ${BOT_SECRET}` }

export interface IngestOpts {
  content: string
  messageId?: string
  authorName?: string
  authorId?: string
  channelId?: string
  threadId?: string
}

/** POST /api/ingest as the bot would, returning the created ticket id. */
export async function ingest(request: APIRequestContext, opts: IngestOpts): Promise<number> {
  // Unique per call regardless of module/worker state, so ingest never dedups
  // one test's message against another's.
  const messageId = opts.messageId ?? `msg-${randomUUID()}`
  const res = await request.post('/api/ingest', {
    headers: BOT_AUTH,
    data: {
      message_id: messageId,
      content: opts.content,
      author_id: opts.authorId ?? 'author-1',
      author_name: opts.authorName ?? 'tester',
      channel_id: opts.channelId ?? 'channel-1',
      ...(opts.threadId ? { thread_id: opts.threadId } : {}),
    },
  })
  if (!res.ok()) throw new Error(`ingest failed: ${res.status()} ${await res.text()}`)
  const body = (await res.json()) as { ticket_id: number }
  return body.ticket_id
}

/** Poll until `predicate` returns truthy or the timeout elapses. */
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  { timeout = 15_000, interval = 150 }: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const deadline = Date.now() + timeout
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > deadline) throw new Error('waitFor: timed out')
    await new Promise((r) => setTimeout(r, interval))
  }
}

/** Read the assessment row directly (the API doesn't expose it). */
export function readAssessment(ticketId: number): AIAssessment | null {
  return (getDb().prepare('SELECT * FROM ai_assessments WHERE ticket_id = ?').get(ticketId) as AIAssessment) ?? null
}

/** Block until the ingest pipeline's background work (agent + assess) finishes. */
export async function waitForAssessment(ticketId: number): Promise<AIAssessment> {
  return waitFor<AIAssessment | null>(() => readAssessment(ticketId)) as Promise<AIAssessment>
}

export function readTicketRow(ticketId: number): Record<string, unknown> | undefined {
  return getDb().prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Record<string, unknown> | undefined
}

/** The Discord message id of the AI answer posted for a ticket (for feedback). */
export function readAnswerMessageId(ticketId: number): string | null {
  const row = getDb()
    .prepare('SELECT discord_message_id FROM answer_messages WHERE ticket_id = ? LIMIT 1')
    .get(ticketId) as { discord_message_id: string } | undefined
  return row?.discord_message_id ?? null
}

export function countFeedback(ticketId: number): { up: number; down: number } {
  const rows = getDb()
    .prepare('SELECT vote FROM ticket_feedback WHERE ticket_id = ?')
    .all(ticketId) as { vote: string }[]
  return {
    up: rows.filter((r) => r.vote === 'up').length,
    down: rows.filter((r) => r.vote === 'down').length,
  }
}
