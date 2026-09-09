import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Second runtime guard for app/api/events/stream/route.ts, covering the parts
// of the LISTEN rewrite that events-stream-teardown.test.ts does not reach.
//
// That file proves the *lifecycle*: one connection per stream, LISTEN via
// `unsafe` on that connection, the 4-minute heartbeat on the same socket, and
// every teardown path. It says nothing about the three other ways this route
// can fail silently:
//
//   1. The SHAPE of the connection. `max: 1` is what makes "one Postgres
//      connection per browser tab" true (#129) — counting `postgres()` calls
//      cannot see a pool that was allowed to grow. `max_lifetime: null` is
//      what stops postgres.js recycling the socket underneath the
//      subscription: its default is a randomised 30-60 minutes
//      (`max_lifetime()` in node_modules/postgres/src/index.js), and because
//      LISTEN is registered by hand here rather than through the `.listen()`
//      sugar, nothing re-registers it on the replacement socket. The
//      heartbeat would keep passing on that fresh socket while no NOTIFY ever
//      arrived again. postgres.js sets both of these on its own internal
//      listen instance (index.js:152-154) for exactly these reasons.
//
//   2. The DISPATCH inside `onnotify`. The teardown test delivers one
//      `data_changed` for the session's own org; it never asserts that
//      another org's NOTIFY is dropped, never exercises `member_joined`, and
//      never sends a payload that is not a clean integer.
//
//   3. The paths that must open NO connection or NO stream at all: a missing
//      direct URL, and a LISTEN that fails during setup.
//
// Same mock style as events-stream-teardown.test.ts — every `postgres()` call
// produces its own tracked instance — with two additions: the direct-URL
// resolver is a spy so the 503 path can be driven, and `failQueries` lets a
// specific statement reject so LISTEN setup failure can be simulated.

type FakeSql = {
  queries: string[]
  options: Record<string, unknown>
  unsafe: ReturnType<typeof vi.fn>
  listen: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
}

const { instances, end, postgresFactory, auth, directUrl, failQueries } = vi.hoisted(() => {
  const made: FakeSql[] = []
  const endFn = vi.fn(async () => {})
  // Statements added here reject once, so a LISTEN can fail during setup.
  const fail = new Set<string>()
  const factory = vi.fn((_url: string, options: Record<string, unknown>) => {
    const queries: string[] = []
    const sql = () => {}
    Object.assign(sql, {
      queries,
      options,
      unsafe: vi.fn(async (q: string) => {
        queries.push(q)
        if (fail.has(q)) {
          fail.delete(q)
          throw new Error('terminating connection due to administrator command')
        }
        return []
      }),
      // The sugar opens a hidden second instance and runs LISTEN there.
      listen: vi.fn(async () => {
        throw new Error('.listen() sugar must not be used by this route')
      }),
      end: endFn,
    })
    made.push(sql as unknown as FakeSql)
    return sql
  })
  const authFn = vi.fn(async () => ({ user: { id: 1 }, orgId: 7 }) as unknown)
  const urlFn = vi.fn((): string | undefined => 'postgres://user@localhost:5432/db')
  return {
    instances: made,
    end: endFn,
    postgresFactory: factory,
    auth: authFn,
    directUrl: urlFn,
    failQueries: fail,
  }
})

/** The single connection the route opened for this stream. */
const conn = () => instances[0]

vi.mock('postgres', () => ({ default: postgresFactory }))
vi.mock('@/auth', () => ({ auth }))
vi.mock('@/lib/db/direct-url', () => ({ getDirectDatabaseUrl: directUrl }))
const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { warn, info: vi.fn(), error: vi.fn() } }))

import { GET } from '@/app/api/events/stream/route'

const decoder = new TextDecoder()

function open(): Promise<Response> {
  return GET(new Request('https://app.example.com/api/events/stream') as never)
}

/** Reads one frame, leaving the reader open for the next one. */
async function frame(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value, done } = await reader.read()
  return done ? '' : decoder.decode(value)
}

describe('GET /api/events/stream — connection shape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    instances.length = 0
    failQueries.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('caps the listener pool at a single connection', async () => {
    const res = await open()
    const reader = res.body!.getReader()
    await frame(reader)

    // "One Postgres connection per open tab" (#129) is a property of `max`,
    // not of how many times postgres() was called. Raising it would leave the
    // teardown test's `instances.toHaveLength(1)` passing while every tab was
    // free to hold a poolful of sockets against a serverless database.
    expect(conn().options.max).toBe(1)

    reader.releaseLock()
    await res.body!.cancel()
  })

  it('disables max_lifetime so the LISTEN socket is never recycled under the subscription', async () => {
    const res = await open()
    const reader = res.body!.getReader()
    await frame(reader)

    // postgres.js's default max_lifetime is a randomised 30-60 minutes. LISTEN
    // is registered by hand here (no `.listen()` sugar, so no auto-resubscribe
    // on reconnect), which means a lifetime-driven recycle would silently drop
    // the subscription — and the heartbeat would keep passing on the fresh
    // socket, so nothing would notice until the 15-minute stream recycle.
    expect(conn().options.max_lifetime).toBeNull()

    reader.releaseLock()
    await res.body!.cancel()
  })

  it('falls back to DEFAULT_ORG_ID when the session carries no orgId', async () => {
    auth.mockResolvedValueOnce({ user: { id: 1 } } as never)
    const res = await open()
    const reader = res.body!.getReader()
    expect(await frame(reader)).toContain('event: connected')

    // A broken fallback (e.g. `?? undefined`) makes the org comparison always
    // false: the stream connects, heartbeats and looks perfectly healthy while
    // delivering no event ever again. DEFAULT_ORG_ID is 1.
    const notify = conn().options.onnotify as (c: string, p: string) => void
    const next = frame(reader)
    notify('data_changed', '1')
    expect(await next).toContain('event: data_changed')

    reader.releaseLock()
    await res.body!.cancel()
  })
})

describe('GET /api/events/stream — refusal paths open no connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    instances.length = 0
    failQueries.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 503 without opening a connection when no direct URL is configured', async () => {
    directUrl.mockReturnValueOnce(undefined)

    const res = await open()

    // postgres(undefined) does not throw — the driver falls back to
    // PG* environment variables and libpq defaults, so dropping this guard
    // means every request quietly dials localhost instead of erroring.
    expect(res.status).toBe(503)
    expect(postgresFactory).not.toHaveBeenCalled()
  })

  it('ends the connection and sends no connected frame when LISTEN registration fails', async () => {
    failQueries.add('LISTEN data_changed')

    const res = await open()
    const reader = res.body!.getReader()

    // Setup failed, so the stream closes without ever emitting: the read
    // completes as done rather than yielding a frame.
    const { done, value } = await reader.read()
    expect(done).toBe(true)
    expect(value).toBeUndefined()

    // The connection must not be left dangling on a subscription that was
    // never registered — that is a leaked socket per failed tab, and a stream
    // that would sit silent until the 15-minute recycle.
    expect(end).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls.map(([msg]) => msg)).toContain('SSE listen setup failed')
  })
})

describe('GET /api/events/stream — browser keepalive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    instances.length = 0
    failQueries.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pings the browser every 25s without touching Postgres', async () => {
    const res = await open()
    const reader = res.body!.getReader()
    await frame(reader)
    const afterSetup = [...conn().queries]

    const next = frame(reader)
    await vi.advanceTimersByTimeAsync(25_000)

    // Proxies (Railway, Vercel, nginx) drop an idle connection near 60s, so
    // this has to land well inside that window.
    expect(await next).toContain('event: ping')

    // And it must stay browser-ward only. A keepalive that queried Postgres
    // would hold a serverless compute awake for every open tab — the exact
    // cost this whole design exists to avoid, and it would be invisible
    // because the stream would look perfectly healthy.
    expect(conn().queries).toEqual(afterSetup)

    reader.releaseLock()
    await res.body!.cancel()
  })

  it('emits cycle as the last frame before the 15-minute recycle closes the stream', async () => {
    const res = await open()
    const reader = res.body!.getReader()
    await frame(reader)

    const frames: string[] = []
    const drain = (async () => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        frames.push(decoder.decode(value))
      }
    })()

    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    await drain

    // `cycle` is a keepalive on the client (lib/live-events.ts KEEPALIVE_EVENTS)
    // and must reach the browser BEFORE the controller closes — enqueueing
    // after close is swallowed, so an ordering slip here loses the frame
    // silently. It resets the staleness clock across the recycle so the
    // watchdog does not race the browser's own reconnect and tear down a
    // stream that is in the middle of being rebuilt.
    expect(frames.at(-1)).toContain('event: cycle')
    expect(frames.filter((f) => f.includes('event: ping')).length).toBeGreaterThan(30)
  })
})

describe('GET /api/events/stream — keepalive interval vs the client staleness window', () => {
  const root = process.cwd()
  const routeSrc = fs.readFileSync(path.join(root, 'app/api/events/stream/route.ts'), 'utf-8')
  const clientSrc = fs.readFileSync(path.join(root, 'lib/live-events.ts'), 'utf-8')

  const num = (src: string, name: string): number => {
    const m = src.match(new RegExp(`const ${name} = ([0-9_]+)`))
    expect(m, `${name} not found`).toBeTruthy()
    return Number(m![1].replace(/_/g, ''))
  }

  it('pings at least twice inside the client STALE_MS window', () => {
    // Cross-file contract, and the kind that breaks in total silence. The
    // client presumes the connection dead after STALE_MS with no event and
    // rebuilds the stream; the server's ping is what refutes that on an idle
    // dashboard. Raise KEEPALIVE_MS above STALE_MS and every open tab enters a
    // permanent teardown/rebuild loop — each rebuild firing a `resync` and a
    // full `router.refresh()` — which is worse than the poll this design
    // replaced, while every single-file test on both sides still passes.
    //
    // Two pings of headroom, so one dropped or delayed ping is not enough on
    // its own to trip the watchdog.
    const keepalive = num(routeSrc, 'KEEPALIVE_MS')
    const stale = num(clientSrc, 'STALE_MS')
    expect(keepalive * 2).toBeLessThan(stale)
  })
})

describe('GET /api/events/stream — onnotify dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    instances.length = 0
    failQueries.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Opens a stream, drains `connected`, and hands back the notify hook. */
  async function connected() {
    const res = await open()
    const reader = res.body!.getReader()
    await frame(reader)
    return {
      res,
      reader,
      notify: conn().options.onnotify as (c: string, p: string) => void,
    }
  }

  /**
   * Fires every `bad` notification, then a `sentinel` one that must get
   * through, and asserts the very next frame is the sentinel's.
   *
   * The sentinel deliberately uses a DIFFERENT event name from the dropped
   * ones: each `send` is its own enqueue, so a leaked notification would be
   * the frame this read returns and the sentinel would still be queued behind
   * it. Waiting on the absence of a frame would just hang.
   */
  async function drops(
    notify: (c: string, p: string) => void,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    bad: Array<[channel: string, payload: string]>,
    sentinel: string,
  ) {
    const next = frame(reader)
    for (const [c, p] of bad) notify(c, p)
    notify(sentinel, '7') // this session's own org, well-formed
    const received = await next
    expect(received).toContain(`event: ${sentinel}`)
    expect(received.match(/event: /g)).toHaveLength(1)
  }

  it('drops a NOTIFY carrying another org id', async () => {
    const { res, reader, notify } = await connected()

    // The trigger payload is COALESCE(NEW.org_id, OLD.org_id) — every tenant's
    // writes arrive on this same channel and on every open stream. A broken
    // filter leaks one org's activity signal to every other org's dashboards.
    await drops(
      notify,
      reader,
      [
        ['data_changed', '8'],
        ['data_changed', '70'],
        ['data_changed', '1'],
      ],
      'member_joined',
    )

    reader.releaseLock()
    await res.body!.cancel()
  })

  it('drops a payload that is not cleanly an org id', async () => {
    const { res, reader, notify } = await connected()

    // `Number()` rather than `parseInt()` matters here: parseInt('7abc') is 7,
    // so a prefix-matching payload would be treated as this org's.
    await drops(
      notify,
      reader,
      (['7abc', '7 8', '', '  ', 'NaN', 'null'] as const).map(
        (p) => ['data_changed', p] as [string, string],
      ),
      'member_joined',
    )

    reader.releaseLock()
    await res.body!.cancel()
  })

  it('delivers member_joined as well as data_changed', async () => {
    const { res, reader, notify } = await connected()

    // The route LISTENs on both channels, but only a dispatch entry turns a
    // NOTIFY into a frame. Dropping `member_joined` from the map leaves the
    // LISTEN registered and the source-level tests passing while the invite
    // flow's live update quietly stops working.
    const next = frame(reader)
    notify('member_joined', '7')
    expect(await next).toContain('event: member_joined')

    reader.releaseLock()
    await res.body!.cancel()
  })

  it('ignores a NOTIFY on a channel the route never subscribed to', async () => {
    const { res, reader, notify } = await connected()

    // Dispatch is a lookup, not an echo: an unknown channel must not become an
    // SSE event name. `toString` and `constructor` are in the list because the
    // channel map is an object literal, so those keys resolve to
    // Object.prototype members — they must be inert, not invoked into a frame
    // and not thrown out of the driver's notify callback.
    await drops(
      notify,
      reader,
      [
        ['some_other_channel', '7'],
        ['toString', '7'],
        ['constructor', '7'],
      ],
      'data_changed',
    )

    reader.releaseLock()
    await res.body!.cancel()
  })
})
