import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Covers the event-driven dashboard-refresh change on
// perf/event-driven-dashboard-refresh, which replaces a fixed client-side
// dashboard poll with a Postgres NOTIFY -> SSE push:
//
//   1. lib/db/migrate.ts gains an idempotent `notify_data_changed()` trigger
//      function plus two triggers. `trg_data_changed_tickets` fires on
//      INSERT OR UPDATE OR DELETE; `trg_data_changed_notifications` fires on
//      INSERT OR DELETE ONLY — never UPDATE, because marking notifications
//      read is a bulk UPDATE with nothing new to display. Payload is
//      COALESCE(NEW.org_id, OLD.org_id) so a NOTIFY only wakes its tenant.
//
//   2. app/api/events/stream/route.ts is rewritten to LISTEN on both
//      `data_changed` and `member_joined` (both filtered by orgId), and to
//      give its ReadableStream a real `cancel()` that tears down the LISTEN
//      connection + keepalive + recycle timer. The old code returned a
//      cleanup fn from start() that never ran — a leaked postgres connection
//      per disconnected browser tab. A fixed STREAM_MAX_AGE_MS recycle timer
//      forces EventSource to rebuild the stream; there is deliberately NO
//      server-side heartbeat query (no SELECT 1) on the listener connection.
//
// No live DB / Docker here: assertions are string/regex checks on source,
// same style as listen-notify-direct-connection.test.ts. The direct-connection
// requirement itself is already covered there and is not duplicated.

const ROOT = process.cwd()

function read(relPath: string): string {
  const abs = path.join(ROOT, relPath)
  expect(fs.existsSync(abs), `File not found: ${relPath}`).toBe(true)
  return fs.readFileSync(abs, 'utf-8')
}

// Collapse whitespace so multi-line SQL can be matched as a single string.
function flat(s: string): string {
  return s.replace(/\s+/g, ' ')
}

describe('lib/db/migrate.ts — data_changed trigger', () => {
  const src = read('lib/db/migrate.ts')
  const flatSrc = flat(src)

  it('defines a notify_data_changed() plpgsql trigger function', () => {
    expect(flatSrc).toContain('CREATE OR REPLACE FUNCTION notify_data_changed()')
    expect(flatSrc).toMatch(/RETURNS trigger LANGUAGE plpgsql/i)
  })

  it('pg_notify uses the data_changed channel with a COALESCE(NEW.org_id, OLD.org_id) payload', () => {
    expect(flatSrc).toContain(
      "PERFORM pg_notify('data_changed', COALESCE(NEW.org_id, OLD.org_id)::text)",
    )
    expect(flatSrc).toContain('RETURN COALESCE(NEW, OLD)')
  })

  it('creates the tickets trigger idempotently, AFTER INSERT OR UPDATE OR DELETE, FOR EACH ROW', () => {
    expect(flatSrc).toContain('DROP TRIGGER IF EXISTS trg_data_changed_tickets ON tickets')
    expect(flatSrc).toMatch(
      /CREATE TRIGGER trg_data_changed_tickets AFTER INSERT OR UPDATE OR DELETE ON tickets FOR EACH ROW EXECUTE FUNCTION notify_data_changed\(\)/,
    )
  })

  it('creates the notifications trigger AFTER INSERT OR DELETE only — never UPDATE', () => {
    expect(flatSrc).toContain(
      'DROP TRIGGER IF EXISTS trg_data_changed_notifications ON notifications',
    )
    const m = flatSrc.match(
      /CREATE TRIGGER trg_data_changed_notifications AFTER ([A-Z ]+?) ON notifications FOR EACH ROW EXECUTE FUNCTION notify_data_changed\(\)/,
    )
    expect(m, 'notifications trigger CREATE statement not found').toBeTruthy()
    const events = m![1].trim()
    expect(events).toBe('INSERT OR DELETE')
    expect(events).not.toContain('UPDATE')
  })

  it('adds the block inside runMigrations()', () => {
    const fnIdx = src.indexOf('export async function runMigrations()')
    expect(fnIdx).toBeGreaterThan(-1)
    expect(src.indexOf('notify_data_changed')).toBeGreaterThan(fnIdx)
  })
})

describe('app/api/events/stream/route.ts — listeners', () => {
  const src = read('app/api/events/stream/route.ts')

  it('registers a data_changed LISTEN as well as member_joined', () => {
    expect(src).toContain("listener.listen('data_changed'")
    expect(src).toContain("listener.listen('member_joined'")
  })

  it('filters both channels by the session orgId via Number(payload) === orgId', () => {
    expect(src).toMatch(/Number\(payload\)\s*===\s*orgId/)
  })
})

describe('app/api/events/stream/route.ts — teardown regression guard', () => {
  const src = read('app/api/events/stream/route.ts')

  it('the ReadableStream defines a cancel() handler (the leaked-connection fix)', () => {
    expect(src).toMatch(/cancel\s*\(\s*\)\s*\{/)
  })

  it('teardown clears the keepalive interval and ends the listener connection', () => {
    expect(src).toContain('clearInterval(keepalive)')
    expect(src).toMatch(/listener\.end\(/)
  })

  it('no longer returns a cleanup function from start() (the code path that never ran)', () => {
    expect(src).not.toMatch(/return\s*\(\s*\)\s*=>\s*cleanup\(\)/)
  })
})

describe('app/api/events/stream/route.ts — recycle timer, no server heartbeat', () => {
  const src = read('app/api/events/stream/route.ts')

  it('defines a STREAM_MAX_AGE_MS recycle timeout that ends the stream', () => {
    expect(src).toContain('STREAM_MAX_AGE_MS')
    expect(src).toMatch(/setTimeout\([\s\S]*?STREAM_MAX_AGE_MS\s*\)/)
    expect(src).toContain('clearTimeout(recycle)')
  })

  it('does NOT run a server-side heartbeat / SELECT 1 poll on the listener connection', () => {
    expect(src).not.toMatch(/SELECT\s+1/i)
    expect(src).not.toContain('sql.unsafe')
    expect(src).not.toMatch(/listener`/)
    expect(src).not.toMatch(/listener\.unsafe/)
  })
})
