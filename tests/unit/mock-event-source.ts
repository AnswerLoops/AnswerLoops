/**
 * Shared test double for `EventSource`, which happy-dom does not implement.
 *
 * Install it per test file with
 * `vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)`
 * and call `MockEventSource.reset()` in `beforeEach`, since the instance list
 * is static and would otherwise leak across tests.
 *
 * `openCount` is the assertion that matters most here: `lib/live-events` exists
 * so a tab holds exactly one stream, and each stream costs a dedicated Postgres
 * LISTEN connection on the server.
 *
 * Not a `.test.ts` file, so vitest's `include` globs do not collect it.
 */

type Listener = (ev: Event) => void

export class MockEventSource {
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

  /** Dispatch a server event to everything listening for it on this stream. */
  emit(type: string) {
    this.listeners[type]?.forEach((cb) => cb(new Event(type)))
  }

  static reset() {
    MockEventSource.instances = []
  }

  /** How many streams have been constructed — one per tab is the invariant. */
  static get openCount() {
    return MockEventSource.instances.length
  }

  static get last() {
    return MockEventSource.instances[MockEventSource.instances.length - 1]
  }
}

/** happy-dom's `document.hidden` is not writable, so redefine the getter. */
export function defineVisibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
}
