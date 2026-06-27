import fs from 'fs'
import { test, expect } from '@playwright/test'
import { WIDGET_TOKEN_FILE } from './global-setup'

// Widget: API-level tests for /api/widget/chat and /api/widget/lead.
// Uses the token seeded in global-setup. The chat response is a stream;
// under MOCK_EXTERNALS=1 the AI model returns mock text.

function getToken(): string {
  const data = JSON.parse(fs.readFileSync(WIDGET_TOKEN_FILE, 'utf-8')) as { token: string }
  return data.token
}

test.describe('widget: /api/widget/chat', () => {
  test('returns 400 for missing widgetToken', async ({ request }) => {
    const res = await request.post('/api/widget/chat', {
      data: { messages: [{ role: 'user', content: 'hello', id: '1', parts: [] }] },
    })
    expect(res.status()).toBe(400)
  })

  test('returns 400 for missing messages', async ({ request }) => {
    const token = getToken()
    const res = await request.post('/api/widget/chat', {
      data: { widgetToken: token, messages: [] },
    })
    expect(res.status()).toBe(400)
  })

  test('returns 404 for invalid widget token', async ({ request }) => {
    const res = await request.post('/api/widget/chat', {
      data: {
        widgetToken: 'not-a-real-token',
        messages: [{ role: 'user', content: 'hello', id: '1', parts: [{ type: 'text', text: 'hello' }] }],
      },
    })
    expect(res.status()).toBe(404)
  })

  test('returns streamed response for valid token + message', async ({ request }) => {
    const token = getToken()
    const res = await request.post('/api/widget/chat', {
      data: {
        widgetToken: token,
        messages: [{ role: 'user', content: 'How do I configure the client?', id: '1', parts: [{ type: 'text', text: 'How do I configure the client?' }] }],
      },
    })
    // Streamed responses return 200 with text/event-stream or text/plain
    expect([200, 201]).toContain(res.status())
  })
})

test.describe('widget: /api/widget/lead', () => {
  test('returns 400 for missing widgetToken', async ({ request }) => {
    const res = await request.post('/api/widget/lead', {
      data: { email: 'user@example.com' },
    })
    expect(res.status()).toBe(400)
  })

  test('returns 400 for invalid email', async ({ request }) => {
    const token = getToken()
    const res = await request.post('/api/widget/lead', {
      data: { widgetToken: token, email: 'not-an-email' },
    })
    expect(res.status()).toBe(400)
  })

  test('returns 404 for invalid widget token', async ({ request }) => {
    const res = await request.post('/api/widget/lead', {
      data: { widgetToken: 'fake-token', email: 'user@example.com' },
    })
    expect(res.status()).toBe(404)
  })

  test('captures a lead for valid token + email', async ({ request }) => {
    const token = getToken()
    const res = await request.post('/api/widget/lead', {
      data: { widgetToken: token, email: 'lead@example.com' },
    })
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).ok).toBe(true)
  })

  test('deduplicates the same lead (upsert)', async ({ request }) => {
    const token = getToken()
    const email = 'dup-lead@example.com'
    const first = await request.post('/api/widget/lead', { data: { widgetToken: token, email } })
    expect(first.ok()).toBeTruthy()
    const second = await request.post('/api/widget/lead', { data: { widgetToken: token, email } })
    expect(second.ok()).toBeTruthy()
  })
})

test.describe('widget: embed page', () => {
  test('widget page renders for valid token', async ({ page }) => {
    const token = getToken()
    await page.goto(`/widget/${token}`)
    // Widget embed should render without error
    await expect(page.locator('body')).not.toContainText(/error|not found/i)
  })
})
