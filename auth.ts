import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import Google from 'next-auth/providers/google'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/index'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

// Env vars read at module level so missing values surface early.
// Auth.js also auto-reads AUTH_DISCORD_ID, AUTH_DISCORD_SECRET,
// AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET from the environment.

const PUBLIC_PATHS = ['/login', '/api/ingest', '/api/feedback']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Look up or create the user + default org in the DB on first OAuth sign-in.
 * Returns the internal userId and orgId to embed in the JWT.
 */
function provisionUser(email: string, name: string | null, image: string | null, provider: string): { userId: number; orgId: number } {
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

  // Ensure the default org exists (seeded in schema.sql, just in case)
  db.prepare(
    `INSERT OR IGNORE INTO orgs (id, name, slug) VALUES (?, 'Default Workspace', 'default')`
  ).run(DEFAULT_ORG_ID)

  // Upsert membership (idempotent — role stays 'owner' for solo workspaces)
  db.prepare(
    `INSERT OR IGNORE INTO memberships (user_id, org_id, role) VALUES (?, ?, 'owner')`
  ).run(user.id, DEFAULT_ORG_ID)

  return { userId: user.id, orgId: DEFAULT_ORG_ID }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord,
    Google,
  ],

  pages: {
    signIn: '/login',
  },

  callbacks: {
    authorized({ request, auth: session }) {
      const { pathname } = request.nextUrl
      if (isPublic(pathname)) return true
      if (session?.user) return true
      // Unauthenticated — APIs get 401, pages redirect to /login
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return false
    },

    jwt({ token, user, account }) {
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
