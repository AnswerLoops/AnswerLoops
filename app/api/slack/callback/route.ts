import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { upsertIntegration } from '@/lib/db/queries/integrations'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.redirect(new URL('/login', req.url))

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.AUTH_URL ?? req.nextUrl.origin
  const settingsUrl = new URL('/settings', baseUrl)

  if (error || !code) {
    settingsUrl.searchParams.set('slack_error', error ?? 'cancelled')
    return Response.redirect(settingsUrl)
  }

  let orgId: number
  try {
    const decoded = JSON.parse(
      Buffer.from(state ?? '', 'base64url').toString()
    ) as { orgId: number; ts: number }
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error('expired')
    orgId = decoded.orgId
  } catch {
    settingsUrl.searchParams.set('slack_error', 'invalid_state')
    return Response.redirect(settingsUrl)
  }

  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    settingsUrl.searchParams.set('slack_error', 'server_misconfigured')
    return Response.redirect(settingsUrl)
  }

  const redirectUri = `${baseUrl}/api/slack/callback`

  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenRes.json() as {
    ok: boolean
    access_token?: string
    team?: { id: string; name: string }
    error?: string
  }

  if (!tokenData.ok || !tokenData.access_token || !tokenData.team) {
    settingsUrl.searchParams.set('slack_error', tokenData.error ?? 'token_exchange_failed')
    return Response.redirect(settingsUrl)
  }

  // Signing secret is platform-wide — set once in env, not per workspace
  const signingSecret = process.env.SLACK_SIGNING_SECRET ?? ''

  await upsertIntegration({
    orgId,
    platform: 'slack',
    botToken: tokenData.access_token,
    webhookSecret: signingSecret,
    teamId: tokenData.team.id,
  })

  settingsUrl.searchParams.set('slack_connected', '1')
  settingsUrl.searchParams.set('slack_team', tokenData.team.name)
  return Response.redirect(settingsUrl)
}
