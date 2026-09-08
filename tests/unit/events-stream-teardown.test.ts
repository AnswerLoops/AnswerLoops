import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Runtime guard for app/api/events/stream/route.ts's connection teardown.
//
// The route opens one dedicated `postgres(url, { max: 1 })` LISTEN connection
// per SSE stream. Before this test existed, the only coverage
// (dashboard-live-infra.test.ts) was source-string assertions — it passed even
// if `teardown = close` was deleted or `cancel()` was wired to a no-op, which
// is exactly the leaked-connection-per-tab regression the route rewrite fixed.
// This exercises the real ReadableStream: cancelling it (what the platform does
// when the browser disconnects) must end the pg connection and stop the
// keepalive, and a second close must be a no-op.

const { listen, end, unsafe, postgresFactory, auth } = vi.hoisted(() => {
  const listenFn = vi.fn(async () => ({ unlisten: vi.fn() }))
  const endFn = vi.fn(async () => {})
  // The route heartbeats the LISTEN connection with sql.unsafe('SELECT 1');
  // unsafeFn is swappable per test so a failing heartbeat can be simulated.
  const unsafeFn = vi.fn(async () => [])
  const factory = vi.fn(() => {
    const sql = () => {}
    Object.assign(sql, { listen: listenFn, end: endFn, unsafe: unsafeFn })
    return sql
  })
  const authFn = vi.fn(async () => ({ user: { id: 1 }, orgId: 7 }))
  return { listen: listenFn, end: endFn, unsafe: unsafeFn, postgresFactory: factory, auth: authFn }
})

vi.mock('postgres', () => ({ default: postgresFactory }))
vi.mock('@/auth', () => ({ auth }))
vi.mock('@/lib/db/direct-url', () => ({
  getDirectDatabaseUrl: () => 'postgres://user@localhost:5432/db',
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { GET } from '@/app/api/events/stream/route'

function firstFrame(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  return reader.read().then(({ value }) => {
    reader.releaseLock()
    return new TextDecoder().decode(value)
  })
}

describe('GET /api/events/stream — connection teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends a connected frame and registers both LISTEN channels', async () => {
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(await firstFrame(res)).toContain('event: connected')
    expect(listen).toHaveBeenCalledWith('data_changed', expect.any(Function))
    expect(listen).toHaveBeenCalledWith('member_joined', expect.any(Function))
    await res.body!.cancel()
  })

  it('cancelling the stream ends the postgres connection exactly once', async () => {
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    await firstFrame(res)
    expect(end).not.toHaveBeenCalled()

    await res.body!.cancel()

    expect(end).toHaveBeenCalledTimes(1)
  })

  it('stops the keepalive interval on cancel — no further work after teardown', async () => {
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    await firstFrame(res)
    await res.body!.cancel()

    end.mockClear()
    // If the keepalive interval or the recycle timeout were still live they
    // would fire here; nothing should touch the connection after teardown.
    vi.advanceTimersByTime(20 * 60 * 1000)
    expect(end).not.toHaveBeenCalled()
  })

  it('the 15-minute recycle and a later cancel do not double-close', async () => {
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    await firstFrame(res)

    // recycle timer fires -> close() -> one end()
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    expect(end).toHaveBeenCalledTimes(1)

    // platform then cancels the already-closed stream -> close() is a no-op
    await res.body!.cancel()
    expect(end).toHaveBeenCalledTimes(1)
  })

  it('heartbeats the LISTEN connection every 4 minutes', async () => {
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    await firstFrame(res)
    expect(unsafe).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    expect(unsafe).toHaveBeenCalledWith('SELECT 1')
    expect(unsafe).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    expect(unsafe).toHaveBeenCalledTimes(2)

    // A healthy heartbeat must not disturb the stream.
    expect(end).not.toHaveBeenCalled()
    await res.body!.cancel()
  })

  it('closes the stream when the heartbeat fails, so the browser reconnects', async () => {
    unsafe.mockRejectedValueOnce(new Error('connection terminated') as never)
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    await firstFrame(res)

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)

    // The whole point: detecting a dead LISTEN and then sitting on it would be
    // no better than not detecting it. Ending the stream makes EventSource
    // rebuild it, which re-registers LISTEN and fires resync on the client.
    expect(end).toHaveBeenCalledTimes(1)
  })

  it('stops heartbeating after teardown', async () => {
    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)
    await firstFrame(res)
    await res.body!.cancel()
    unsafe.mockClear()

    // A leaked heartbeat interval would query a closed connection forever —
    // and keep a serverless compute awake for a tab that is long gone.
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(unsafe).not.toHaveBeenCalled()
  })

  it('returns 401 without a session and opens no connection', async () => {
    auth.mockResolvedValueOnce(null as never)

    const res = await GET(new Request('https://app.example.com/api/events/stream') as never)

    expect(res.status).toBe(401)
    expect(postgresFactory).not.toHaveBeenCalled()
  })
})
