import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { getDirectDatabaseUrl } from '@/lib/db/direct-url'
import { logger } from '@/lib/logger'
import postgres from 'postgres'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const MOD = 'sse'

// Proxies (Railway, Vercel, nginx) drop an idle connection around 60s. This
// ping is sent browser-ward only — it never queries Postgres, so it does not
// keep a serverless database compute from suspending on idle.
const KEEPALIVE_MS = 25_000

// Deliberately end the stream on a fixed cycle and let the browser's
// EventSource rebuild it. A LISTEN connection can die silently on some
// network paths (proxy idle-drop, database failover, a laptop sleeping)
// without the clean close event that postgres.js's auto-resubscribe needs to
// see. Recycling caps how long a silently-dead LISTEN can persist even if
// the client-side staleness watchdog also misses it. There is deliberately
// no server-side heartbeat query on this connection: that would generate
// steady database load and defeat the reason this stream exists.
const STREAM_MAX_AGE_MS = 15 * 60 * 1000

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const orgId = (session as { orgId?: number }).orgId ?? DEFAULT_ORG_ID

  const url = getDirectDatabaseUrl()
  if (!url) return new Response('database not configured', { status: 503 })

  const encoder = new TextEncoder()
  // Assigned inside start(); cancel() runs it when the client disconnects.
  let teardown = () => {}

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const send = (event: string, data: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
        } catch {
          // Client already gone — teardown runs via cancel().
        }
      }

      // Dedicated connection: a NOTIFY arrives on whichever backend Postgres
      // picks, so a pooled connection can miss it (same reason as the bot's
      // config listener). postgres.js does not idle-close a connection by
      // default, so the LISTEN stays registered between notifications.
      const listener = postgres(url, { max: 1 })

      const keepalive = setInterval(() => send('ping', '{}'), KEEPALIVE_MS)

      const recycle = setTimeout(() => {
        send('cycle', '{}')
        close()
      }, STREAM_MAX_AGE_MS)

      const close = () => {
        if (closed) return
        closed = true
        clearInterval(keepalive)
        clearTimeout(recycle)
        listener.end({ timeout: 5 }).catch(() => {})
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      teardown = close

      const forOrg = (event: string) => (payload: string) => {
        if (Number(payload) === orgId) send(event, '{}')
      }

      try {
        await listener.listen('data_changed', forOrg('data_changed'))
        await listener.listen('member_joined', forOrg('member_joined'))
        send('connected', '{}')
      } catch (err) {
        logger.warn('SSE listen setup failed', { module: MOD, orgId, error: err })
        close()
      }
    },
    cancel() {
      teardown()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable nginx / Railway proxy buffering so events reach the client
      // immediately instead of being held in a buffer.
      'X-Accel-Buffering': 'no',
    },
  })
}
