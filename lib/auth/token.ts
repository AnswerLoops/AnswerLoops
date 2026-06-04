import crypto from 'crypto'

export const SESSION_COOKIE = 'session'
export const MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is not set')
  }
  return secret
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function hmac(body: string): string {
  return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url')
}

/**
 * Sign a stateless session token: `base64url(payload).base64url(hmac)`.
 * Payload only carries an expiry — there's a single shared staff identity for now.
 */
export function signSession(expSeconds: number): string {
  const body = base64url(JSON.stringify({ exp: expSeconds }))
  return `${body}.${hmac(body)}`
}

/** Verify token signature + expiry. Returns true when the session is valid. */
export function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false

  const expected = hmac(body)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return false
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false

  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof exp === 'number' && exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
