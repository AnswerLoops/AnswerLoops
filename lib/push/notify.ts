import webpush from 'web-push'
import { getDb } from '@/lib/db'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'
import type { PushSubscription } from '@/types'

function initWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL ?? 'mailto:admin@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  }
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  // Skip real web-push in tests: the VAPID test key is not a valid curve point,
  // and we never want to hit push endpoints. The /api/push routes are still
  // covered directly.
  if (MOCK_EXTERNALS) return
  if (!process.env.VAPID_PUBLIC_KEY) return

  initWebPush()

  const subscriptions = getDb()
    .prepare('SELECT * FROM push_subscriptions')
    .all() as PushSubscription[]

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  )

  // Remove expired subscriptions (410 Gone)
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 410) {
        getDb()
          .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
          .run(subscriptions[i].endpoint)
      }
    }
  })
}
