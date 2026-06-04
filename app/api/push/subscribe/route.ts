import { z } from 'zod'
import { getDb } from '@/lib/db'

const SubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = SubSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid subscription' }, { status: 400 })

  const { endpoint, keys } = parsed.data
  getDb().prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
  `).run(endpoint, keys.p256dh, keys.auth)

  return Response.json({ ok: true })
}
