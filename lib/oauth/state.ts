import { createHmac, timingSafeEqual } from 'node:crypto'

// Signed `state` for the outbound OAuth / app-install flows (Discord, Slack,
// GitHub, Outlook). The value carries the caller's org id across the redirect
// to the third party and back; the signature is what lets the callback treat
// the org id as one this server issued for this caller rather than an
// arbitrary input.
//
// Format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256 of the first part)>`
// keyed with AUTH_SECRET (already required for the app to boot). The payload
// always carries `ts`; verify() enforces a max age.

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000

function key(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set — cannot sign OAuth state')
  return Buffer.from(secret, 'utf8')
}

function sign(body: string): string {
  return createHmac('sha256', key()).update(body).digest('base64url')
}

export interface OAuthStatePayload {
  orgId: number
  ts: number
  /** Which surface started the flow, so the callback redirects back to it. */
  from?: string
}

export function signOAuthState(payload: Omit<OAuthStatePayload, 'ts'> & { ts?: number }): string {
  const full: OAuthStatePayload = { ...payload, ts: payload.ts ?? Date.now() }
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url')
  return `${body}.${sign(body)}`
}

/**
 * Parse and authenticate a `state` value. Throws on a missing value, a bad
 * signature, malformed JSON, or an expired timestamp — callers treat any throw
 * as `invalid_state` and must not fall back to a default org.
 */
export function verifyOAuthState(
  raw: string | null | undefined,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): OAuthStatePayload {
  if (!raw) throw new Error('missing state')
  const dot = raw.lastIndexOf('.')
  if (dot < 1) throw new Error('malformed state')

  const body = raw.slice(0, dot)
  const provided = Buffer.from(raw.slice(dot + 1), 'base64url')
  const expected = Buffer.from(sign(body), 'base64url')
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('bad state signature')
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload
  if (!Number.isInteger(payload.orgId) || payload.orgId < 1) throw new Error('bad state payload')
  if (!Number.isFinite(payload.ts) || Date.now() - payload.ts > maxAgeMs) throw new Error('expired state')
  return payload
}
