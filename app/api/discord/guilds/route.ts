import { NextRequest } from 'next/server'
import { auth } from '@/auth'

interface DiscordChannel {
  id: string
  name: string
  type: number
}

interface DiscordGuild {
  id: string
  name: string
}

export interface GuildWithChannels {
  id: string
  name: string
  channels: { id: string; name: string }[]
}

// Discord channel types that can receive messages
const TEXT_CHANNEL_TYPES = new Set([0, 5, 10, 11, 12, 15])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { token?: string }
  const token = body.token?.trim()
  if (!token) return Response.json({ error: 'Bot token required' }, { status: 400 })

  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }

  const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers })
  if (!guildsRes.ok) {
    if (guildsRes.status === 401) return Response.json({ error: 'Invalid bot token. Check it was copied from the Bot tab, not the OAuth2 tab.' }, { status: 400 })
    return Response.json({ error: 'Discord API error. Try again.' }, { status: 502 })
  }

  const guilds = await guildsRes.json() as DiscordGuild[]

  const results: GuildWithChannels[] = await Promise.all(
    guilds.map(async (guild) => {
      const chRes = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/channels`, { headers })
      if (!chRes.ok) return { id: guild.id, name: guild.name, channels: [] }
      const channels = await chRes.json() as DiscordChannel[]
      return {
        id: guild.id,
        name: guild.name,
        channels: channels
          .filter((c) => TEXT_CHANNEL_TYPES.has(c.type) && c.name)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ id: c.id, name: c.name })),
      }
    })
  )

  return Response.json(results)
}
