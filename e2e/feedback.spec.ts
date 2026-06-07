import { test, expect } from '@playwright/test'
import {
  BOT_AUTH,
  ingest,
  waitForAssessment,
  waitFor,
  readAnswerMessageId,
  countFeedback,
} from './helpers'

// The bot forwards 👍/👎 reactions to /api/feedback; this covers auth, the
// unknown-message no-op, and a vote being attributed to the right ticket.
test.describe('POST /api/feedback', () => {
  test('requires the bot secret', async ({ request }) => {
    const res = await request.post('/api/feedback', {
      data: { message_id: 'x', vote: 'up', actor: 'u1' },
    })
    expect(res.status()).toBe(401)
  })

  test('ignores a reaction on a non-answer message', async ({ request }) => {
    const res = await request.post('/api/feedback', {
      headers: BOT_AUTH,
      data: { message_id: 'not-an-answer', vote: 'up', actor: 'u1' },
    })
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).ignored).toBe(true)
  })

  test('records a Discord vote against the answer’s ticket', async ({ request }) => {
    const ticketId = await ingest(request, { content: 'How do I configure the client?' })
    await waitForAssessment(ticketId)

    // The agent mapped its posted answer message to the ticket.
    const messageId = await waitFor(() => readAnswerMessageId(ticketId))

    const up = await request.post('/api/feedback', {
      headers: BOT_AUTH,
      data: { message_id: messageId, vote: 'up', actor: 'community-1' },
    })
    expect((await up.json()).ticket_id).toBe(ticketId)
    expect(countFeedback(ticketId)).toEqual({ up: 1, down: 0 })

    // Re-voting from the same actor overwrites, not appends.
    await request.post('/api/feedback', {
      headers: BOT_AUTH,
      data: { message_id: messageId, vote: 'down', actor: 'community-1' },
    })
    expect(countFeedback(ticketId)).toEqual({ up: 0, down: 1 })
  })
})
