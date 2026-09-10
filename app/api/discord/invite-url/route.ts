import { type NextRequest, NextResponse } from 'next/server'
import { requireOrgAccess } from '@/lib/auth/org'
import { signOAuthState } from '@/lib/oauth/state'
import { orgHasFeature } from '@/lib/billing/entitlements-server'

// Permissions: View Channel + Send Messages + Read Message History + Add Reactions + Embed Links
const PERMISSIONS = '85056'

export async function GET(req: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'DISCORD_CLIENT_ID not configured' }, { status: 503 })
  }

  const access = await requireOrgAccess()
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 401 })
  }
  const { orgId } = access

  if (!(await orgHasFeature(orgId, 'discord_integration'))) {
    return NextResponse.json({ error: 'Discord integration requires the Standard plan or above' }, { status: 403 })
  }

  const baseUrl = process.env.AUTH_URL ?? req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/discord/callback`

  // Where the flow started, so the callback returns the user to the right
  // screen. Only 'onboarding' is meaningful; anything else means Settings.
  const from = req.nextUrl.searchParams.get('from') === 'onboarding' ? 'onboarding' : 'settings'
  const state = signOAuthState({ orgId, from })

  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=${PERMISSIONS}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`

  return NextResponse.json({ url })
}
