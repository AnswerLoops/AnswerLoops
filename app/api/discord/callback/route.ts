import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { auth } from '@/auth'
import { getIntegration, upsertIntegration } from '@/lib/db/queries/integrations'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.redirect(new URL('/login', req.url))
  }

  const { searchParams } = req.nextUrl
  const guildId = searchParams.get('guild_id')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.AUTH_URL ?? req.nextUrl.origin
  const settingsUrl = new URL('/settings', baseUrl)

  // User cancelled or Discord returned an error
  if (error || !guildId) {
    settingsUrl.searchParams.set('discord_error', error ?? 'cancelled')
    return Response.redirect(settingsUrl)
  }

  // Decode state to get orgId
  let orgId: number
  try {
    const decoded = JSON.parse(Buffer.from(state ?? '', 'base64url').toString()) as { orgId: number; ts: number }
    // Reject state older than 10 minutes
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error('expired')
    orgId = decoded.orgId
  } catch {
    settingsUrl.searchParams.set('discord_error', 'invalid_state')
    return Response.redirect(settingsUrl)
  }

  // Ensure a bot_secret exists for this org's Discord integration
  const existing = await getIntegration(orgId, 'discord')
  const botSecret = existing?.bot_secret ?? crypto.randomBytes(32).toString('hex')

  await upsertIntegration({
    orgId,
    platform: 'discord',
    connectedGuildId: guildId,
    botSecret: existing?.bot_secret ? undefined : botSecret,
  })

  settingsUrl.searchParams.set('discord_connected', '1')
  settingsUrl.searchParams.set('guild_id', guildId)
  return Response.redirect(settingsUrl)
}
