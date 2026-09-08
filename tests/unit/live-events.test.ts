// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LiveEvent } from '@/lib/live-events'

/**
 * `lib/live-events` exists so a tab holds exactly ONE `/api/events/stream`
 * connection no matter how many client islands are watching it. Each stream
 * costs a dedicated, non-pooled Postgres LISTEN connection on the server, so
 * "one EventSource per tab" is the invariant with a real cost behind it —
 * before this module a Settings tab held two.
 *
 * What these tests pin:
 *  - N subscribers share one EventSource; the stream opens on the first and
 *    closes only after the last unsubscribes.
 *  - Events fan out only to the subscribers that asked for them.
 *  - The synthetic `resync` fires on every reopen (tab refocus, staleness
 *    watchdog) but never on the first open of a session — that is how a
 *    subscriber holding client state knows to refetch after a gap.
 *  - A hidden tab holds no connection.
 *
 * The module keeps state at module scope, so each test re-imports it fresh
 * via vi.resetModules().
 */

type Listener = (ev: Event) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  listeners: Record<string, Set<Listener>> = {}
  closed = false
  onerror: ((ev: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: Listener) {
    ;(this.listeners[type] ??= new Set()).add(cb)
  }

  removeEventListener(type: string, cb: Listener) {
    this.listeners[type]?.delete(cb)
  }

  close() {
    this.closed = true
  }

  emit(type: string) {
    this.listeners[type]?.forEach((cb) => cb(new Event(type)))
  }

  static reset() {
    MockEventSource.instances = []
  }

  static get openCount() {
    return MockEventSource.instances.length
  }

  static get last() {
    return MockEventSource.instances[MockEventSource.instances.length - 1]
  }
}

function defineVisibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

function fireVisibilityChange(hidden: boolean) {
  defineVisibility(hidden)
  document.dispatchEvent(new Event('visibilitychange'))
}

let subscribeLiveEvents: typeof import('@/lib/live-events').subscribeLiveEvents

beforeEach(async () => {
  MockEventSource.reset()
  defineVisibility(false)
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
  vi.useFakeTimers()
  vi.resetModules()
  ;({ subscribeLiveEvents } = await import('@/lib/live-events'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('live-events — one connection per tab', () => {
  it('two subscribers share a single EventSource', () => {
    const a = subscribeLiveEvents(['data_changed'], vi.fn())
    const b = subscribeLiveEvents(['member_joined'], vi.fn())

    expect(MockEventSource.openCount).toBe(1)
    expect(MockEventSource.last.url).toBe('/api/events/stream')

    a()
    b()
  })

  it('keeps the stream open while any subscriber remains', () => {
    const a = subscribeLiveEvents(['data_changed'], vi.fn())
    const b = subscribeLiveEvents(['member_joined'], vi.fn())
    const stream = MockEventSource.last

    a()
    expect(stream.closed).toBe(false)

    b()
    expect(stream.closed).toBe(true)
  })

  it('a subscriber joining later reuses the open stream instead of opening a second', () => {
    const a = subscribeLiveEvents(['data_changed'], vi.fn())
    const first = MockEventSource.last

    const handler = vi.fn()
    const b = subscribeLiveEvents(['data_changed'], handler)

    expect(MockEventSource.openCount).toBe(1)

    first.emit('data_changed')
    expect(handler).toHaveBeenCalledTimes(1)

    a()
    b()
  })

  it('reopens a stream when a new subscriber arrives after the last one left', () => {
    subscribeLiveEvents(['data_changed'], vi.fn())()
    expect(MockEventSource.last.closed).toBe(true)

    const b = subscribeLiveEvents(['data_changed'], vi.fn())
    expect(MockEventSource.openCount).toBe(2)
    expect(MockEventSource.last.closed).toBe(false)

    b()
  })
})

describe('live-events — event fan-out', () => {
  it('delivers an event only to subscribers that asked for it', () => {
    const dataOnly = vi.fn()
    const memberOnly = vi.fn()
    const a = subscribeLiveEvents(['data_changed'], dataOnly)
    const b = subscribeLiveEvents(['member_joined'], memberOnly)

    MockEventSource.last.emit('data_changed')
    expect(dataOnly).toHaveBeenCalledTimes(1)
    expect(memberOnly).not.toHaveBeenCalled()

    MockEventSource.last.emit('member_joined')
    expect(memberOnly).toHaveBeenCalledTimes(1)
    expect(dataOnly).toHaveBeenCalledTimes(1)

    a()
    b()
  })

  it('passes the event name to the handler', () => {
    const seen: LiveEvent[] = []
    const a = subscribeLiveEvents(['data_changed', 'member_joined'], (e) => seen.push(e))

    MockEventSource.last.emit('member_joined')
    MockEventSource.last.emit('data_changed')

    expect(seen).toEqual(['member_joined', 'data_changed'])
    a()
  })

  it('stops delivering to a subscriber once it unsubscribes', () => {
    const handler = vi.fn()
    const a = subscribeLiveEvents(['data_changed'], handler)
    const keepOpen = subscribeLiveEvents(['member_joined'], vi.fn())
    const stream = MockEventSource.last

    a()
    stream.emit('data_changed')

    expect(handler).not.toHaveBeenCalled()
    keepOpen()
  })

  it('survives a handler that unsubscribes itself while the event is dispatching', () => {
    const other = vi.fn()
    let selfOff = () => {}
    selfOff = subscribeLiveEvents(['data_changed'], () => selfOff())
    const b = subscribeLiveEvents(['data_changed'], other)

    expect(() => MockEventSource.last.emit('data_changed')).not.toThrow()
    expect(other).toHaveBeenCalledTimes(1)

    b()
  })
})

describe('live-events — resync on reopen', () => {
  it('does not emit resync on the first open', () => {
    const handler = vi.fn()
    const a = subscribeLiveEvents(['resync'], handler)

    expect(MockEventSource.openCount).toBe(1)
    expect(handler).not.toHaveBeenCalled()

    a()
  })

  it('emits resync when the tab becomes visible again', () => {
    const handler = vi.fn()
    const a = subscribeLiveEvents(['resync'], handler)

    fireVisibilityChange(true)
    expect(handler).not.toHaveBeenCalled()

    fireVisibilityChange(false)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('resync')

    a()
  })

  it('emits resync when the staleness watchdog rebuilds the stream', () => {
    const handler = vi.fn()
    const a = subscribeLiveEvents(['resync'], handler)
    const first = MockEventSource.last

    vi.advanceTimersByTime(75_000) // > STALE_MS with no beat

    expect(first.closed).toBe(true)
    expect(MockEventSource.openCount).toBe(2)
    expect(handler).toHaveBeenCalledTimes(1)

    a()
  })

  it.each(['connected', 'ping', 'cycle'])(
    'a %s keepalive resets the staleness clock',
    (keepalive) => {
      const handler = vi.fn()
      const a = subscribeLiveEvents(['resync'], handler)
      const first = MockEventSource.last

      vi.advanceTimersByTime(60_000)
      first.emit(keepalive)
      vi.advanceTimersByTime(60_000)

      // Without this event counting as a beat the watchdog would have torn the
      // stream down at 70s, churning a Postgres LISTEN connection and firing a
      // spurious resync refetch on every subscriber.
      expect(first.closed).toBe(false)
      expect(MockEventSource.openCount).toBe(1)
      expect(handler).not.toHaveBeenCalled()

      a()
    }
  )

  it.each(['data_changed', 'member_joined'])(
    'a %s also resets the staleness clock',
    (dataEvent) => {
      const resync = vi.fn()
      const a = subscribeLiveEvents(['resync'], resync)
      const first = MockEventSource.last

      vi.advanceTimersByTime(60_000)
      first.emit(dataEvent)
      vi.advanceTimersByTime(60_000)

      // A stream carrying real events is plainly alive; treating only pings as
      // proof of life would rebuild it every 70s under steady traffic.
      expect(first.closed).toBe(false)
      expect(MockEventSource.openCount).toBe(1)
      expect(resync).not.toHaveBeenCalled()

      a()
    }
  )

  it('a keepalive ping holds the watchdog off, so no resync fires', () => {
    const handler = vi.fn()
    const a = subscribeLiveEvents(['resync'], handler)
    const first = MockEventSource.last

    vi.advanceTimersByTime(60_000)
    first.emit('ping')
    vi.advanceTimersByTime(15_000)

    expect(first.closed).toBe(false)
    expect(MockEventSource.openCount).toBe(1)
    expect(handler).not.toHaveBeenCalled()

    a()
  })
})

describe('live-events — hidden tab holds no connection', () => {
  it('does not open a stream when the first subscriber arrives on a hidden tab', () => {
    defineVisibility(true)
    const a = subscribeLiveEvents(['data_changed'], vi.fn())

    expect(MockEventSource.openCount).toBe(0)
    a()
  })

  it('closes the stream when the tab is hidden and does not run the watchdog', () => {
    const a = subscribeLiveEvents(['data_changed'], vi.fn())
    const first = MockEventSource.last

    fireVisibilityChange(true)
    expect(first.closed).toBe(true)

    vi.advanceTimersByTime(300_000)
    expect(MockEventSource.openCount).toBe(1)

    a()
  })

  it('the last unsubscribe leaves no timer running', () => {
    const a = subscribeLiveEvents(['data_changed'], vi.fn())
    expect(vi.getTimerCount()).toBeGreaterThan(0) // the staleness watchdog

    a()

    // checkStaleness early-returns once the stream is gone, so a watchdog that
    // is never cleared leaks silently — one interval per subscriber-count-to-
    // zero cycle, which in this SPA is every trip away from a dashboard route.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('the last unsubscribe removes the visibilitychange listener', () => {
    subscribeLiveEvents(['data_changed'], vi.fn())()

    fireVisibilityChange(true)
    fireVisibilityChange(false)

    expect(MockEventSource.openCount).toBe(1)
    expect(MockEventSource.last.closed).toBe(true)
  })
})
