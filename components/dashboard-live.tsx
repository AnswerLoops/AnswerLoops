'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Keeps DB-backed dashboard pages current without a fixed-interval poll.
 *
 * Primary path: a Server-Sent Events stream (`/api/events/stream`) pushes a
 * `data_changed` event whenever a ticket or notification row changes for this
 * org. We call `router.refresh()` once in response (debounced to collapse a
 * burst of writes). While nothing changes, no requests are made at all and a
 * serverless database is free to suspend.
 *
 * This replaced a `router.refresh()` every 5 seconds, which re-ran every
 * Server Component query on the route regardless of whether anything had
 * changed — continuous database load for as long as a tab stayed open.
 *
 * Resilience, because an SSE / LISTEN connection can die silently (proxy
 * idle-drop, DB failover, laptop sleep) with no error surfacing to either
 * end:
 *  - Staleness watchdog: if no event or keepalive `ping` arrives within
 *    STALE_MS, close and reopen the EventSource, which rebuilds a fresh
 *    server-side LISTEN.
 *  - Backstop refresh: a slow `router.refresh()` every BACKSTOP_MS while the
 *    tab is visible, so a missed notification delays an update by at most
 *    that long rather than indefinitely.
 *  - The stream is closed entirely while the tab is hidden and reopened on
 *    return, so a backgrounded tab holds no database connection.
 */

const STALE_MS = 70_000
const WATCHDOG_MS = 15_000
const BACKSTOP_MS = 60_000
const DEBOUNCE_MS = 400

export function DashboardLive() {
  const router = useRouter()

  useEffect(() => {
    let es: EventSource | null = null
    let debounce: ReturnType<typeof setTimeout> | undefined
    let lastBeat = Date.now()
    let stopped = false

    const refreshNow = () => router.refresh()

    const refreshDebounced = () => {
      clearTimeout(debounce)
      debounce = setTimeout(refreshNow, DEBOUNCE_MS)
    }

    const beat = () => {
      lastBeat = Date.now()
    }

    const openStream = () => {
      if (stopped || es) return
      beat()
      es = new EventSource('/api/events/stream')
      es.addEventListener('connected', beat)
      es.addEventListener('ping', beat)
      es.addEventListener('cycle', beat)
      es.addEventListener('data_changed', () => {
        beat()
        refreshDebounced()
      })
      es.addEventListener('member_joined', () => {
        beat()
        refreshDebounced()
      })
      // EventSource retries on its own after a transient network error; a
      // silently-dead upstream LISTEN never reaches here, which is what the
      // watchdog below is for.
      es.onerror = () => {}
    }

    const closeStream = () => {
      es?.close()
      es = null
    }

    const watchdog = setInterval(() => {
      if (document.hidden || !es) return
      if (Date.now() - lastBeat > STALE_MS) {
        closeStream()
        openStream()
      }
    }, WATCHDOG_MS)

    const backstop = setInterval(() => {
      if (!document.hidden) refreshNow()
    }, BACKSTOP_MS)

    const onVisibility = () => {
      if (document.hidden) {
        closeStream()
      } else {
        refreshNow()
        openStream()
      }
    }

    if (!document.hidden) openStream()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      clearTimeout(debounce)
      clearInterval(watchdog)
      clearInterval(backstop)
      closeStream()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [router])

  return null
}
