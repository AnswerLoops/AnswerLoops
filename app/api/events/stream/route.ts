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
// both the heartbeat below and the client-side watchdog miss it.
const STREAM_MAX_AGE_MS = 15 * 60 * 1000

// Heartbeat on the LISTEN connection itself, matching the bot's config
// listener (bot/index.ts). The browser-ward `ping` above proves only that the
// HTTP stream is alive; it never touches Postgres, so a LISTEN that has died
// underneath a healthy stream is invisible without this. A failed heartbeat
// ends the stream, the browser reconnects, and every subscriber gets a
// `resync` — which is what makes the client's backstop affordable at ten
// minutes instead of one.
//
// An earlier revision of this route omitted the heartbeat on the grounds that
// it would generate steady database load. That reasoning does not survive the
// arithmetic: one SELECT 1 every four minutes is 15 trivial queries an hour,
// against the ~780 real ones a 60-second client backstop was already spending
// per open tab. This is a net reduction, not an addition.
const LISTEN_HEARTBEAT_MS = 4 * 60 * 1000

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

      // Every event this stream sends is a bare signal with no payload — the
      // client re-fetches on its own — so the data line is always `{}`.
      const send = (event: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`))
        } catch {
          // Client already gone — teardown runs via cancel().
        }
      }

      // Dedicated connection: a NOTIFY arrives on whichever backend Postgres
      // picks, so a pooled connection can miss it (same reason as the bot's
      // config listener). postgres.js does not idle-close a connection by
      // default, so the LISTEN stays registered between notifications.
      const listener = postgres(url, { max: 1 })

      const keepalive = setInterval(() => send('ping'), KEEPALIVE_MS)

      // If the connection is gone, close the stream rather than sitting on a
      // dead LISTEN: the browser reopens and the server registers a fresh one.
      const heartbeat = setInterval(() => {
        listener.unsafe('SELECT 1').catch((err) => {
          logger.warn('SSE listener heartbeat failed', { module: MOD, orgId, error: err })
          close()
        })
      }, LISTEN_HEARTBEAT_MS)

      const recycle = setTimeout(() => {
        send('cycle')
        close()
      }, STREAM_MAX_AGE_MS)

      const close = () => {
        if (closed) return
        closed = true
        clearInterval(keepalive)
        clearInterval(heartbeat)
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
        if (Number(payload) === orgId) send(event)
      }

      try {
        await listener.listen('data_changed', forOrg('data_changed'))
        await listener.listen('member_joined', forOrg('member_joined'))
        send('connected')
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
