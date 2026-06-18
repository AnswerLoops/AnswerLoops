// Process-local fixed-window rate limiter. Good enough for a single-instance
// deployment; swap for a shared store (Redis) if we scale horizontally.
const buckets = new Map<string, { count: number; reset: number }>()

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
