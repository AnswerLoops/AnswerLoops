'use client'

/**
 * One shared Server-Sent Events connection per browser tab.
 *
 * `/api/events/stream` opens a dedicated, non-pooled Postgres LISTEN
 * connection for the life of each stream — a NOTIFY lands on whichever
 * backend Postgres picks, so a pooled connection can miss it. That makes an
 * open stream expensive on a connection-capped database, and before this
 * module a Settings tab held two of them: one from `DashboardLive` (mounted
 * on every dashboard route by the layout) and one from the Settings page's
 * own live team-member list, both LISTENing on an overlapping channel set.
 *
 * Every client island now subscribes here instead of constructing its own
 * `EventSource`. The stream is opened on the first subscriber and closed
 * after the last one goes away, so a tab holds exactly one LISTEN connection
 * no matter how many islands are watching.
 *
 * Resilience lives here too, since it is a property of the connection rather
 * than of any one subscriber. An SSE / LISTEN connection can die silently
 * (proxy idle-drop, database failover, laptop sleep) with no error surfacing
 * to either end, so:
 *  - Staleness watchdog: if no event or keepalive `ping` arrives within
 *    STALE_MS, the stream is torn down and rebuilt, which gives the server a
 *    fresh LISTEN.
 *  - The stream is closed entirely while the tab is hidden and reopened on
 *    return, so a backgrounded tab holds no database connection.
 *
 * Both of those mean a subscriber can miss notifications that fired while the
 * connection was down. Any reopen therefore emits a synthetic `resync` event:
 * subscribers holding their own state re-fetch it rather than waiting for the
 * next change. Only the very first open of a session skips `resync`, because
 * nothing has been missed yet.
 */

const STREAM_URL = '/api/events/stream'

/** No event or keepalive for this long means the connection is presumed dead. */
const STALE_MS = 70_000

/** How often the staleness check runs. */
const WATCHDOG_MS = 15_000

/** Server events that carry meaning, plus the synthetic reopen signal. */
export type LiveEvent = 'data_changed' | 'member_joined' | 'resync'

/** Server events that only reset the staleness clock. */
const KEEPALIVE_EVENTS = ['connected', 'ping', 'cycle'] as const

const DATA_EVENTS = ['data_changed', 'member_joined'] as const

type Subscriber = {
  events: ReadonlySet<LiveEvent>
  handler: (event: LiveEvent) => void
}

const subscribers = new Set<Subscriber>()

let source: EventSource | null = null
let watchdog: ReturnType<typeof setInterval> | undefined
let lastBeat = 0

function emit(event: LiveEvent) {
  // Copy first: a handler may unsubscribe itself while we are iterating.
  for (const sub of [...subscribers]) {
    if (sub.events.has(event)) sub.handler(event)
  }
}

function beat() {
  lastBeat = Date.now()
}

function openStream() {
  if (source || subscribers.size === 0) return
  beat()
  const es = new EventSource(STREAM_URL)
  source = es

  for (const event of KEEPALIVE_EVENTS) es.addEventListener(event, beat)
  for (const event of DATA_EVENTS) {
    es.addEventListener(event, () => {
      beat()
      emit(event)
    })
  }
  // EventSource retries on its own after a transient network error. A
  // silently-dead upstream LISTEN never reaches here — that is what the
  // watchdog is for.
  es.onerror = () => {}
}

function closeStream() {
  source?.close()
  source = null
}

/** Rebuild the connection, then tell subscribers they may have missed events. */
function reopenStream() {
  closeStream()
  openStream()
  emit('resync')
}

function checkStaleness() {
  if (document.hidden || !source) return
  if (Date.now() - lastBeat > STALE_MS) reopenStream()
}

function onVisibilityChange() {
  if (document.hidden) closeStream()
  else reopenStream()
}

function start() {
  watchdog = setInterval(checkStaleness, WATCHDOG_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (!document.hidden) openStream()
}

function stop() {
  clearInterval(watchdog)
  watchdog = undefined
  document.removeEventListener('visibilitychange', onVisibilityChange)
  closeStream()
}

/**
 * Watch `events` on the tab's shared stream. The returned function
 * unsubscribes and must be called on unmount — the connection is closed once
 * the last subscriber leaves.
 *
 * Subscribe to `resync` as well as the events you care about if you hold
 * state that a missed notification would leave stale.
 */
export function subscribeLiveEvents(
  events: readonly LiveEvent[],
  handler: (event: LiveEvent) => void
): () => void {
  const subscriber: Subscriber = { events: new Set(events), handler }
  subscribers.add(subscriber)
  if (subscribers.size === 1) start()

  return () => {
    subscribers.delete(subscriber)
    if (subscribers.size === 0) stop()
  }
}
