import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifyToken } from '@/lib/auth/token'

// Public paths that never require a staff session.
// /api/ingest is authenticated separately via BOT_SECRET (the Discord bot).
const PUBLIC_PATHS = ['/login', '/api/ingest']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  const authed = verifyToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (authed) {
    return NextResponse.next()
  }

  // Unauthenticated: APIs get a 401, pages get redirected to /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:png|svg|ico)$).*)'],
}
