// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MockEventSource, defineVisibility } from './mock-event-source'
import { render, act } from '@testing-library/react'
import { DashboardLive } from '@/components/dashboard-live'

/**
 * DashboardLive is the client island that replaced `<AutoRefresh intervalMs={5000}>`.
 * It renders nothing and lives entirely inside one useEffect. The behaviour that
 * is easy to break silently and that these tests pin:
 *
 *  - It opens exactly one EventSource to `/api/events/stream`, and only while the
 *    tab is visible.
 *  - `data_changed` / `member_joined` collapse into a single debounced
 *    `router.refresh()` (DEBOUNCE_MS = 400).
 *  - A staleness watchdog (every 15s) tears down and rebuilds the stream when no
 *    beat has arrived for > 70s; any keepalive (`ping`, `connected`, `cycle`)
 *    resets that clock.
 *  - A backstop `router.refresh()` every 60s while visible, suppressed while hidden.
 *  - `visibilitychange` closes the stream when hidden and reopens + refreshes on
 *    return.
 *  - Unmount clears both intervals, the debounce timeout, the visibility listener
 *    and closes the stream — nothing fires afterwards.
 *
 * happy-dom has no EventSource, so a MockEventSource is installed on the global
 * for the duration of each test and instances are tracked to assert reopen.
 */

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: mockRefresh })),
}))




function fireVisibilityChange(hidden: boolean) {
  defineVisibility(hidden)
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function emit(type: string, source = MockEventSource.last) {
  act(() => {
    source.emit(type)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  MockEventSource.reset()
  defineVisibility(false)
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('DashboardLive — stream lifecycle', () => {
  it('opens exactly one EventSource to /api/events/stream on mount while visible', () => {
    render(<DashboardLive />)

    expect(MockEventSource.openCount).toBe(1)
    expect(MockEventSource.last.url).toBe('/api/events/stream')
    expect(MockEventSource.last.closed).toBe(false)
  })

  it('does not open a stream on mount when the tab is already hidden', () => {
    defineVisibility(true)
    render(<DashboardLive />)

    expect(MockEventSource.openCount).toBe(0)
  })
})

describe('DashboardLive — debounced refresh on data events', () => {
  it('a single data_changed triggers exactly one router.refresh() after 400ms', () => {
    render(<DashboardLive />)

    emit('data_changed')
    expect(mockRefresh).not.toHaveBeenCalled()

    advance(399)
    expect(mockRefresh).not.toHaveBeenCalled()

    advance(1)
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('multiple data_changed within the debounce window collapse into one refresh', () => {
    render(<DashboardLive />)

    emit('data_changed')
    advance(100)
    emit('data_changed')
    advance(100)
    emit('data_changed')
    advance(399)
    expect(mockRefresh).not.toHaveBeenCalled()

    advance(1)
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('member_joined also triggers a debounced refresh', () => {
    render(<DashboardLive />)

    emit('member_joined')
    advance(400)

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('DashboardLive — staleness watchdog', () => {
  it('closes and reopens the stream after > 70s with no beat while visible', () => {
    render(<DashboardLive />)
    const first = MockEventSource.last

    advance(75_000)

    expect(first.closed).toBe(true)
    expect(MockEventSource.openCount).toBe(2)
    expect(MockEventSource.last).not.toBe(first)
    expect(MockEventSource.last.closed).toBe(false)
  })

  it('refreshes immediately when the watchdog rebuilds a stale stream', () => {
    render(<DashboardLive />)

    advance(60_000)
    mockRefresh.mockClear() // discard the 60s backstop refresh

    advance(15_000) // watchdog tick at 75s: > 70s with no beat

    // The reopen emits `resync`: the connection was down, so a change may have
    // been missed. That refresh is immediate, not debounced.
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('a ping within the window resets lastBeat and prevents the reopen', () => {
    render(<DashboardLive />)
    const first = MockEventSource.last

    advance(60_000)
    emit('ping', first)
    advance(15_000)

    expect(first.closed).toBe(false)
    expect(MockEventSource.openCount).toBe(1)
  })
})

describe('DashboardLive — idle backstop', () => {
  const BACKSTOP = 10 * 60 * 1000

  // Advance time on a stream the server is keeping alive: it sends `ping`
  // every 25s, so the staleness watchdog never trips in production and must
  // not trip here either, or its reconnect resyncs would be counted as
  // backstop refreshes. A ping is deliberately NOT proof the LISTEN works, so
  // it must not re-arm the backstop — that distinction is what these tests pin.
  const advanceAlive = (ms: number) => {
    for (let left = ms; left > 0; left -= 25_000) {
      advance(Math.min(25_000, left))
      emit('ping')
    }
  }

  it('fires only after BACKSTOP_MS of silence, not on a fixed interval', () => {
    render(<DashboardLive />)

    advanceAlive(BACKSTOP - 30_000)
    // The old fixed 60s interval would have refreshed nine times by now.
    expect(mockRefresh).not.toHaveBeenCalled()

    advanceAlive(60_000)
    expect(mockRefresh).toHaveBeenCalledTimes(1)

    // And it re-arms itself: a LISTEN that stays dead must keep being caught,
    // not caught once and then abandoned.
    advanceAlive(BACKSTOP)
    expect(mockRefresh).toHaveBeenCalledTimes(2)
  })

  it('a data_changed re-arms it, so an active dashboard never runs it', () => {
    render(<DashboardLive />)

    // An arriving event is itself proof the LISTEN is alive, which is exactly
    // what the backstop exists to check — so it should reset the clock.
    for (let i = 0; i < 5; i++) {
      advanceAlive(BACKSTOP - 60_000)
      emit('data_changed')
      advance(400) // debounce
    }

    // Five refreshes from the events themselves, none from the backstop.
    expect(mockRefresh).toHaveBeenCalledTimes(5)
  })

  it('a keepalive ping alone does not re-arm it', () => {
    render(<DashboardLive />)

    // A ping travels over HTTP and never touches Postgres, so it says nothing
    // about whether the LISTEN behind it is alive. Treating it as proof would
    // make the backstop blind to the exact failure it guards against.
    advanceAlive(BACKSTOP + 30_000)

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not fire while the tab is hidden, and stays armed for its return', () => {
    render(<DashboardLive />)

    fireVisibilityChange(true)
    mockRefresh.mockClear()

    advance(BACKSTOP * 3)
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})

describe('DashboardLive — visibilitychange', () => {
  it('closes the stream when the tab is hidden', () => {
    render(<DashboardLive />)
    const first = MockEventSource.last

    fireVisibilityChange(true)

    expect(first.closed).toBe(true)
    expect(MockEventSource.openCount).toBe(1)
  })

  it('reopens the stream and refreshes immediately when the tab becomes visible again', () => {
    render(<DashboardLive />)
    fireVisibilityChange(true)
    mockRefresh.mockClear()

    fireVisibilityChange(false)

    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(MockEventSource.openCount).toBe(2)
    expect(MockEventSource.last.closed).toBe(false)
  })
})

describe('DashboardLive — resync supersedes a pending debounce', () => {
  it('refreshes once when resync lands on top of an armed data_changed', () => {
    render(<DashboardLive />)

    emit('data_changed') // arms the 400ms debounce
    advance(100)

    fireVisibilityChange(true)
    fireVisibilityChange(false) // reopen -> resync -> immediate refresh
    advance(1_000)

    // The debounced refresh must be cancelled, not left to fire behind the
    // resync's — the two would refresh the same route twice for one event.
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('DashboardLive — unmount cleanup', () => {
  it('closes the stream and stops all timers so nothing fires after unmount', () => {
    const { unmount } = render(<DashboardLive />)
    const first = MockEventSource.last

    unmount()

    expect(first.closed).toBe(true)

    advance(300_000)
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(MockEventSource.openCount).toBe(1)
  })

  it('clears a pending debounce timeout on unmount (no refresh for an in-flight data_changed)', () => {
    const { unmount } = render(<DashboardLive />)

    emit('data_changed')
    unmount()
    advance(1_000)

    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
