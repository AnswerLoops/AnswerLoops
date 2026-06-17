import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import Google from 'next-auth/providers/google'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/index'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

// Env vars read at module level so missing values surface early.
// Auth.js also auto-reads AUTH_DISCORD_ID, AUTH_DISCORD_SECRET,
// AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET from the environment.

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/ingest', '/api/feedback', '/api/slack', '/api/widget', '/widget']
const ONBOARDING_PATH = '/onboarding'
// Invite acceptance is accessible regardless of onboarding status.
const INVITE_PREFIX = '/invite/'

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Upsert the user, then find or create their org workspace.
 * New users get a fresh org; returning users land back in their existing one.
 */
function provisionUser(
  email: string,
  name: string | null,
  image: string | null,
  provider: string
): { userId: number; orgId: number } {
  const db = getDb()

  // Upsert user
  db.prepare(
    `INSERT INTO users (email, name, image, provider)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = COALESCE(excluded.name, name),
       image = COALESCE(excluded.image, image)`
  ).run(email, name ?? null, image ?? null, provider)

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number }

  // Returning user: find existing membership
  const existing = db
    .prepare('SELECT org_id FROM memberships WHERE user_id = ? LIMIT 1')
    .get(user.id) as { org_id: number } | null

  if (existing) {
    return { userId: user.id, orgId: existing.org_id }
  }

  // New user: create a fresh org workspace (unboarded until they complete the wizard)
  const orgResult = db
    .prepare(`INSERT INTO orgs (name, slug) VALUES ('My Workspace', ?)`)
    .run(`org-${user.id}-${Date.now()}`)

  const orgId = Number(orgResult.lastInsertRowid)
  db.prepare(`INSERT OR IGNORE INTO memberships (user_id, org_id, role) VALUES (?, ?, 'owner')`).run(
    user.id,
    orgId
  )

  return { userId: user.id, orgId }
}

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  providers: [
    Discord,
    Google,
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    authorized({ request, auth: session }) {
      const { pathname } = request.nextUrl
      if (isPublic(pathname)) return true

      if (!session?.user) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return false // redirects to /login
      }

      // Authenticated: enforce onboarding for page routes only
      if (
        pathname !== ONBOARDING_PATH &&
        !pathname.startsWith(INVITE_PREFIX) &&
        !pathname.startsWith('/api/')
      ) {
        const orgId = (session as { orgId?: number }).orgId ?? DEFAULT_ORG_ID
        const org = getDb()
          .prepare('SELECT onboarded_at FROM orgs WHERE id = ?')
          .get(orgId) as { onboarded_at: string | null } | undefined
        if (!org?.onboarded_at) {
          return NextResponse.redirect(new URL(ONBOARDING_PATH, request.nextUrl))
        }
      }

      return true
    },

    jwt({ token, user, account, trigger, session: updateData }) {
      // unstable_update() call — merge new orgId into the token
      if (trigger === 'update' && updateData) {
        const data = updateData as { orgId?: number }
        if (data.orgId) token.orgId = data.orgId
      }
      // Runs on sign-in (user + account present) and on every session read (token only)
      if (user?.email && account) {
        const { userId, orgId } = provisionUser(
          user.email,
          user.name ?? null,
          user.image ?? null,
          account.provider
        )
        token.userId = String(userId)
        token.orgId = orgId
      }
      return token
    },

    session({ session, token }) {
      session.orgId = (token.orgId as number | undefined) ?? DEFAULT_ORG_ID
      if (session.user) {
        session.user.id = token.userId as string ?? token.sub ?? ''
      }
      return session
    },
  },
})
