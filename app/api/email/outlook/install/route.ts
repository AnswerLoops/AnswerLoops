import { NextRequest } from 'next/server'
import { requireOrgAccess } from '@/lib/auth/org'
import { signOAuthState } from '@/lib/oauth/state'
import { buildOutlookAuthUrl } from '@/lib/email/outlook'

export async function GET(req: NextRequest) {
  const access = await requireOrgAccess()
  if (!access.ok) return Response.redirect(new URL('/login', req.url))

  const state = signOAuthState({ orgId: access.orgId })

  const authUrl = buildOutlookAuthUrl(state)
  if (typeof authUrl !== 'string') {
    const settingsUrl = new URL('/settings', process.env.AUTH_URL ?? req.nextUrl.origin)
    settingsUrl.searchParams.set('tab', 'email')
    settingsUrl.searchParams.set('outlook_error', 'server_misconfigured')
    return Response.redirect(settingsUrl)
  }

  return Response.redirect(authUrl)
}
