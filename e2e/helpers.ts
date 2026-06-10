import { randomUUID } from 'crypto'
import type { APIRequestContext } from '@playwright/test'

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
  return ((await res.json()) as { ticket_id: number }).ticket_id
}

/**
 * The Discord message id the mock posts an AI answer under. Mirrors the mock in
 * lib/discord/send.ts (keyed on the channel), so a test that ingests with a
 * known channel knows the answer's message id without reading the database.
 */
export function answerMessageId(channelId: string): string {
  return `mock-msg-${channelId}`
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

interface TicketResponse {
  ticket: Record<string, unknown>
  assessment: Record<string, unknown> | null
}

async function fetchTicket(request: APIRequestContext, ticketId: number): Promise<TicketResponse | null> {
  const res = await request.get(`/api/tickets/${ticketId}`)
  if (!res.ok()) return null
  return (await res.json()) as TicketResponse
}

/** GET a ticket via the API (reads through the server's own db connection). */
export async function getTicket(
  request: APIRequestContext,
  ticketId: number
): Promise<Record<string, unknown> | null> {
  return (await fetchTicket(request, ticketId))?.ticket ?? null
}

/**
 * Block until the ingest pipeline's background work finishes. Polls through the
 * API (the server reads its own db connection); the app runs in a separate
 * process so we never read the SQLite file directly from the test runner.
 *
 * Waits for the assessment, which the agent saves at the end of the pipeline —
 * a later signal than ai_draft_status flipping off 'pending', so the ticket
 * detail page is guaranteed to have its confidence panel by the time we look.
 */
export async function waitForPipeline(
  request: APIRequestContext,
  ticketId: number
): Promise<Record<string, unknown>> {
  return waitFor(async () => (await fetchTicket(request, ticketId))?.assessment ?? false) as Promise<
    Record<string, unknown>
  >
}

/** Poll a ticket field through the API until it matches. */
export async function waitForTicketField(
  request: APIRequestContext,
  ticketId: number,
  field: string,
  value: unknown
): Promise<void> {
  await waitFor(async () => {
    const t = await getTicket(request, ticketId)
    return t != null && t[field] === value
  })
}
