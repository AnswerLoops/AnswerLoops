import { NextRequest } from 'next/server'
import { auth } from '@/auth'

const SCOPES = 'channels:history,channels:read,chat:write,reactions:write'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) return Response.json({ error: 'SLACK_CLIENT_ID not configured' }, { status: 503 })

  const baseUrl = process.env.AUTH_URL ?? req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/slack/callback`
  const orgId = (session as { orgId?: number }).orgId ?? 1
  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url')

  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  return Response.json({ url: url.toString() })
}
