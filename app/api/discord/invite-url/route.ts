import { NextRequest } from 'next/server'
import { auth } from '@/auth'

// Permissions: View Channel + Send Messages + Read Message History + Add Reactions + Use Slash Commands
const BOT_PERMISSIONS = '2147552320'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) return Response.json({ error: 'DISCORD_CLIENT_ID not configured' }, { status: 503 })

  const baseUrl = process.env.AUTH_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const redirectUri = `${baseUrl}/api/discord/callback`

  // Encode orgId into state so the callback knows which org is connecting.
  // Sign it with AUTH_SECRET to prevent CSRF.
  const orgId = (session as { orgId?: number }).orgId ?? 1
  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url')

  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'bot applications.commands')
  url.searchParams.set('permissions', BOT_PERMISSIONS)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  return Response.json({ url: url.toString(), redirectUri })
}
