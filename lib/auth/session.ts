import { cookies } from 'next/headers'
import { MAX_AGE_SECONDS, SESSION_COOKIE, signSession, verifyToken } from '@/lib/auth/token'

/** Create a session and store it in an httpOnly cookie. */
export async function createSession(): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  const token = signSession(exp)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

/** Delete the session cookie (logout). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/** Read + verify the current session from cookies. */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  return verifyToken(cookieStore.get(SESSION_COOKIE)?.value)
}
