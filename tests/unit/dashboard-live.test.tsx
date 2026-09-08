// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

type Listener = (ev: Event) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  listeners: Record<string, Set<Listener>> = {}
  closed = false
  closeCalls = 0
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
    this.closeCalls += 1
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
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
}

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

describe('DashboardLive — backstop refresh', () => {
  it('router.refresh() fires roughly every 60s while visible', () => {
    render(<DashboardLive />)

    // Keep the stream healthy so the staleness watchdog stays out of the way
    // and the only refreshes counted here are the backstop's.
    const keepAlive = () => emit('ping')

    advance(30_000)
    keepAlive()
    advance(30_000)
    expect(mockRefresh).toHaveBeenCalledTimes(1)

    advance(30_000)
    keepAlive()
    advance(30_000)
    expect(mockRefresh).toHaveBeenCalledTimes(2)
  })

  it('does not fire the backstop refresh while the tab is hidden', () => {
    render(<DashboardLive />)

    fireVisibilityChange(true)
    mockRefresh.mockClear()

    advance(180_000)
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
