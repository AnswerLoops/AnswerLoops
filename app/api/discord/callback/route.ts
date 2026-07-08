import { type NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { auth } from '@/auth'
import { getIntegration, upsertIntegration } from '@/lib/db/queries/integrations'

export async function GET(req: NextRequest) {
  const session = await auth()
  const baseUrl = process.env.AUTH_URL ?? req.nextUrl.origin

  if (!session?.user) {
    return Response.redirect(new URL('/login', baseUrl))
  }

  const { searchParams } = req.nextUrl
  const guildId = searchParams.get('guild_id')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Decode state to determine where to redirect after
  let orgId: number
  let from: string = 'settings'
  try {
    const decoded = JSON.parse(Buffer.from(state ?? '', 'base64url').toString()) as {
      orgId: number
      ts: number
      from?: string
    }
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error('expired')
    orgId = decoded.orgId
    from = decoded.from ?? 'settings'
  } catch {
    orgId = (session as { orgId?: number }).orgId ?? 1
  }

  const failUrl = new URL(from === 'onboarding' ? '/onboarding' : '/settings', baseUrl)

  if (error || !guildId) {
    failUrl.searchParams.set('discord_error', error ?? 'cancelled')
    return Response.redirect(failUrl)
  }

  const existing = await getIntegration(orgId, 'discord')
  const botSecret = existing?.bot_secret ?? crypto.randomBytes(32).toString('hex')

  await upsertIntegration({
    orgId,
    platform: 'discord',
    connectedGuildId: guildId,
    botSecret: existing?.bot_secret ? undefined : botSecret,
  })

  if (from === 'onboarding') {
    const next = new URL('/onboarding', baseUrl)
    next.searchParams.set('discord_connected', '1')
    return Response.redirect(next)
  }

  const settingsUrl = new URL('/settings', baseUrl)
  settingsUrl.searchParams.set('tab', 'discord')
  settingsUrl.searchParams.set('discord_connected', '1')
  settingsUrl.searchParams.set('guild_id', guildId)
  return Response.redirect(settingsUrl)
}
