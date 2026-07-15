import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle'
import { users, memberships, orgs } from '@/lib/db/schema'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const PUBLIC_PATHS = ['/', '/login', '/api/auth', '/api/ingest', '/api/feedback', '/api/slack', '/api/widget', '/widget', '/api/billing/webhook', '/api/waitlist', '/api/health', '/api/github/webhook', '/api/email/ingest']
const ONBOARDING_PATH = '/onboarding'
const INVITE_PREFIX = '/invite/'
function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails()
  if (allowed.length === 0) return true
  return allowed.includes(email.toLowerCase())
}

async function provisionUser(
  email: string,
  name: string | null,
  image: string | null,
  provider: string
): Promise<{ userId: number; orgId: number }> {
  const db = getDb()

  // Upsert user
  await db
    .insert(users)
    .values({ email, name, image, provider })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: name ?? undefined,
        image: image ?? undefined,
      },
    })

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)

  // Returning user: find existing membership
  const [existing] = await db
    .select({ orgId: memberships.orgId })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1)

  if (existing) {
    return { userId: user.id, orgId: existing.orgId }
  }

  // New user: create a fresh org workspace
  const [newOrg] = await db
    .insert(orgs)
    .values({ name: 'My Workspace', slug: `org-${user.id}-${Date.now()}` })
    .returning({ id: orgs.id })

  await db
    .insert(memberships)
    .values({ userId: user.id, orgId: newOrg.id, role: 'owner' })
    .onConflictDoNothing()

  return { userId: user.id, orgId: newOrg.id }
}

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  providers: [
    Google,
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? ''
      return isEmailAllowed(email)
    },

    async authorized({ request, auth: session }) {
      const { pathname } = request.nextUrl

      if (isPublic(pathname)) return true

      if (!session?.user) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const loginUrl = new URL('/login', request.nextUrl)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }

      if (
        pathname !== ONBOARDING_PATH &&
        !pathname.startsWith(INVITE_PREFIX) &&
        !pathname.startsWith('/api/')
      ) {
        if (!(session as { onboarded?: boolean }).onboarded) {
          const orgId = (session as { orgId?: number }).orgId ?? DEFAULT_ORG_ID
          const [org] = await getDb()
            .select({ id: orgs.id, onboardedAt: orgs.onboardedAt })
            .from(orgs)
            .where(eq(orgs.id, orgId))
            .limit(1)

          if (!org) {
            return NextResponse.redirect(new URL('/api/auth/signout?callbackUrl=/login', request.nextUrl))
          }

          if (!org.onboardedAt) {
            return NextResponse.redirect(new URL(ONBOARDING_PATH, request.nextUrl))
          }
        }
      }

      return true
    },

    async jwt({ token, user, account, trigger, session: updateData }) {
      if (trigger === 'update' && updateData) {
        const data = updateData as { orgId?: number; onboarded?: boolean }
        if (data.orgId) token.orgId = data.orgId
        if (data.onboarded) token.onboarded = true
      }
      if (user?.email && account) {
        const { userId, orgId } = await provisionUser(
          user.email,
          user.name ?? null,
          user.image ?? null,
          account.provider
        )
        token.userId = String(userId)
        token.orgId = orgId

        // Stamp onboarded into the JWT so returning users never hit /onboarding again
        const [org] = await getDb()
          .select({ onboardedAt: orgs.onboardedAt })
          .from(orgs)
          .where(eq(orgs.id, orgId))
          .limit(1)
        if (org?.onboardedAt) token.onboarded = true
      }
      return token
    },

    session({ session, token }) {
      session.orgId = (token.orgId as number | undefined) ?? DEFAULT_ORG_ID
      session.onboarded = token.onboarded === true
      if (session.user) {
        session.user.id = token.userId as string ?? token.sub ?? ''
      }
      return session
    },
  },
})
