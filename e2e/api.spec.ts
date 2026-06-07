import { test, expect } from '@playwright/test'
import { getDb } from '../lib/db/index'
import { ingest } from './helpers'

test.describe('GET /api/tickets', () => {
  test('lists tickets and filters by status', async ({ request }) => {
    await ingest(request, { content: 'How do I configure the client?' })

    const all = await request.get('/api/tickets')
    expect(all.ok()).toBeTruthy()
    const list = (await all.json()) as Array<{ id: number; status: string }>
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)

    const open = await request.get('/api/tickets?status=open')
    const openList = (await open.json()) as Array<{ status: string }>
    expect(openList.every((t) => t.status === 'open')).toBe(true)

    const resolved = await request.get('/api/tickets?status=resolved')
    expect((await resolved.json()).length).toBe(0)
  })
})

test.describe('GET /api/tickets/[id]', () => {
  test('returns a ticket with replies and events, 404 otherwise', async ({ request }) => {
    const ticketId = await ingest(request, { content: 'How do I configure the client?' })

    const res = await request.get(`/api/tickets/${ticketId}`)
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ticket: { id: number }; replies: unknown[]; events: unknown[] }
    expect(body.ticket.id).toBe(ticketId)
    expect(Array.isArray(body.replies)).toBe(true)
    expect(Array.isArray(body.events)).toBe(true)

    const missing = await request.get('/api/tickets/999999')
    expect(missing.status()).toBe(404)
  })
})

test.describe('FAQ', () => {
  test('generate then fetch the latest snapshot', async ({ request }) => {
    const gen = await request.post('/api/faq/generate')
    expect(gen.ok()).toBeTruthy()
    const genBody = (await gen.json()) as { ok: boolean; snapshot_id: number }
    expect(genBody.ok).toBe(true)

    const faq = await request.get('/api/faq')
    const body = (await faq.json()) as { content: string | null }
    expect(body.content).toContain('FAQ')
  })
})

test.describe('GitHub repos', () => {
  test('lists repos and deletes one', async ({ request }) => {
    const info = getDb()
      .prepare(`INSERT INTO github_repos (installation_id, owner, repo, is_private) VALUES (2, 'temp', 'todelete', 0)`)
      .run()
    const id = Number(info.lastInsertRowid)

    const list = await request.get('/api/github/repos')
    const repos = (await list.json()) as Array<{ id: number }>
    expect(repos.some((r) => r.id === id)).toBe(true)

    const del = await request.delete(`/api/github/repos/${id}`)
    expect((await del.json()).ok).toBe(true)

    const after = (await (await request.get('/api/github/repos')).json()) as Array<{ id: number }>
    expect(after.some((r) => r.id === id)).toBe(false)
  })
})

test.describe('Push', () => {
  test('rejects an invalid subscription, accepts a valid one', async ({ request }) => {
    const bad = await request.post('/api/push/subscribe', { data: { endpoint: 'not-a-url' } })
    expect(bad.status()).toBe(400)

    const good = await request.post('/api/push/subscribe', {
      data: {
        endpoint: 'https://push.example.com/abc',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      },
    })
    expect((await good.json()).ok).toBe(true)

    const row = getDb()
      .prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint = ?')
      .get('https://push.example.com/abc')
    expect(row).toBeTruthy()
  })

  test('exposes the VAPID public key', async ({ request }) => {
    const res = await request.get('/api/push/vapid-key')
    expect((await res.json()).publicKey).toBe('BL_test_vapid_public_key')
  })
})
