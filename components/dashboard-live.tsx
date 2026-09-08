'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeLiveEvents } from '@/lib/live-events'

/**
 * Keeps DB-backed dashboard pages current without a fixed-interval poll.
 *
 * Primary path: the tab's shared Server-Sent Events stream (see
 * `lib/live-events`) pushes a `data_changed` event whenever a ticket or
 * notification row changes for this org. We call `router.refresh()` once in
 * response, debounced to collapse a burst of writes. While nothing changes,
 * no requests are made at all and a serverless database is free to suspend.
 *
 * This replaced a `router.refresh()` every 5 seconds, which re-ran every
 * Server Component query on the route regardless of whether anything had
 * changed — continuous database load for as long as a tab stayed open.
 *
 * The connection itself — opening it, closing it while the tab is hidden, and
 * rebuilding it when it goes stale — belongs to `lib/live-events`, which
 * shares one stream across every island on the page. `resync` means the
 * stream was just rebuilt and events may have been missed while it was down,
 * so we refresh immediately rather than debouncing.
 *
 * On top of that, a backstop `router.refresh()` every BACKSTOP_MS while the
 * tab is visible: the watchdog can only see a dead HTTP stream, so if the
 * stream is healthy but its upstream LISTEN is not, this bounds how long the
 * page can show stale data.
 */

const BACKSTOP_MS = 60_000
const DEBOUNCE_MS = 400

export function DashboardLive() {
  const router = useRouter()

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined

    const refreshNow = () => router.refresh()

    const unsubscribe = subscribeLiveEvents(
      ['data_changed', 'member_joined', 'resync'],
      (event) => {
        if (event === 'resync') {
          // Supersedes any debounced refresh already armed — otherwise a
          // data_changed from 400ms ago fires a second, redundant refresh.
          clearTimeout(debounce)
          refreshNow()
          return
        }
        clearTimeout(debounce)
        debounce = setTimeout(refreshNow, DEBOUNCE_MS)
      }
    )

    const backstop = setInterval(() => {
      if (!document.hidden) refreshNow()
    }, BACKSTOP_MS)

    return () => {
      clearTimeout(debounce)
      clearInterval(backstop)
      unsubscribe()
    }
  }, [router])

  return null
}
