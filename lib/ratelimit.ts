import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle'
import { rateLimitBuckets } from '@/lib/db/schema'

// Process-local fixed-window rate limiter. Good enough for a single-instance
// deployment; swap for a shared store (Redis) if we scale horizontally.
const buckets = new Map<string, { count: number; reset: number }>()

// Expired buckets must be swept, not just overwritten on re-use: some keys
// embed attacker-controlled input (the MCP route keys on x-forwarded-for),
// so an unauthenticated client rotating that value mints a new entry per
// request and the Map otherwise grows without bound.
const SWEEP_INTERVAL_MS = 60_000
let nextSweepAt = Date.now() + SWEEP_INTERVAL_MS

function sweepExpired(now: number): void {
  if (now < nextSweepAt) return
  nextSweepAt = now + SWEEP_INTERVAL_MS
  for (const [key, bucket] of buckets) {
    if (bucket.reset < now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number
}

/**
 * Allow up to `max` hits per `windowMs` for a given `key`.
 * Returns `{ ok: false, retryAfterMs }` once the bucket is exhausted.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweepExpired(now)
  const bucket = buckets.get(key)

  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfterMs: bucket.reset - now }
  }

  bucket.count++
  return { ok: true, retryAfterMs: 0 }
}

// Chance (per call) of firing an opportunistic cleanup of long-stale rows —
// e.g. one-off/scanner IPs that will never come back to re-touch their
// bucket. No cron job: this mirrors the in-process sweeper's spirit without
// needing a scheduler.
const CLEANUP_CHANCE = 0.01

/**
 * Postgres-backed equivalent of `rateLimit`, shared across every instance —
 * fixes #169, where the in-process Map limiter's effective ceiling becomes
 * `max * instance count` on any horizontally-scaled or serverless deploy and
 * resets on every restart.
 *
 * Implemented as a single atomic upsert (INSERT .. ON CONFLICT DO UPDATE)
 * rather than a separate check-then-increment round trip, so two concurrent
 * requests for the same key can't both read the same pre-increment count and
 * both be admitted — the same class of race as #168.
 */
export async function rateLimitShared(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const db = getDb()
  const now = new Date()
  const newReset = new Date(now.getTime() + windowMs)

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, count: 1, resetAt: newReset })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        count: sql`CASE WHEN ${rateLimitBuckets.resetAt} < now() THEN 1 ELSE ${rateLimitBuckets.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimitBuckets.resetAt} < now() THEN ${newReset.toISOString()}::timestamptz ELSE ${rateLimitBuckets.resetAt} END`,
      },
    })
    .returning({ count: rateLimitBuckets.count, resetAt: rateLimitBuckets.resetAt })

  // Fire-and-forget: don't let cleanup latency add to this call's response
  // time, and don't let a cleanup failure fail the rate-limit check itself.
  if (Math.random() < CLEANUP_CHANCE) {
    db.execute(sql`DELETE FROM rate_limit_buckets WHERE reset_at < now() - interval '1 hour'`).catch(
      () => {}
    )
  }

  if (row.count > max) {
    return { ok: false, retryAfterMs: Math.max(0, row.resetAt.getTime() - now.getTime()) }
  }

  return { ok: true, retryAfterMs: 0 }
}
