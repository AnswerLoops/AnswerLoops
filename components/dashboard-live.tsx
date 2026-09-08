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
 * On top of that, a backstop `router.refresh()` bounds how long the page can
 * show stale data if the stream is healthy but its upstream LISTEN is not.
 *
 * The backstop is a dead-man's switch, not a poll: every refresh re-arms it,
 * so it only ever fires after BACKSTOP_MS of complete silence. A dashboard
 * that is receiving events never runs it at all, because an arriving event is
 * itself proof the LISTEN is alive. This matters because the backstop is the
 * entire remaining database cost of an idle open tab — the stream itself
 * issues no queries, and the server's keepalive pings never reach Postgres.
 * At the old fixed 60s it re-ran every Server Component query on the route
 * sixty times an hour, per open tab, forever.
 *
 * Note that only real events may re-arm it. A keepalive `ping` proves the HTTP
 * stream is alive but says nothing about the LISTEN behind it, which is the
 * exact failure this guards against; `lib/live-events` keeps that distinction
 * and only forwards the events that carry meaning.
 *
 * The interval can be this long because the server now heartbeats its own
 * LISTEN connection every 4 minutes and tears the stream down when that fails,
 * which surfaces as a `resync` here. Detection is the heartbeat's job; this is
 * only the last line of defence.
 */

const BACKSTOP_MS = 10 * 60 * 1000
const DEBOUNCE_MS = 400

export function DashboardLive() {
  const router = useRouter()

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    let backstop: ReturnType<typeof setTimeout> | undefined

    // Re-armed after every refresh, so a tab that is receiving events never
    // reaches it. Fires only after BACKSTOP_MS of silence.
    const armBackstop = () => {
      clearTimeout(backstop)
      backstop = setTimeout(() => {
        if (!document.hidden) refreshNow()
        else armBackstop() // hidden: skip the refresh, keep the switch armed
      }, BACKSTOP_MS)
    }

    const refreshNow = () => {
      router.refresh()
      armBackstop()
    }

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

    armBackstop()

    return () => {
      clearTimeout(debounce)
      clearTimeout(backstop)
      unsubscribe()
    }
  }, [router])

  return null
}
