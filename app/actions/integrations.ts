'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { refresh } from 'next/cache'
import { auth } from '@/auth'
import { upsertIntegration, deleteIntegration, getIntegration } from '@/lib/db/queries/integrations'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'

// Discord bot tokens: base64(snowflake).timestamp.hmac
const DISCORD_TOKEN_RE = /^[A-Za-z0-9_-]{20,30}\.[A-Za-z0-9_-]{4,8}\.[A-Za-z0-9_-]{25,50}$/

const DiscordIntegrationSchema = z.object({
  botToken: z
    .string()
    .min(1, 'Bot token is required')
    .regex(DISCORD_TOKEN_RE, 'Invalid Discord bot token format'),
  channelIds: z.string().min(1, 'At least one channel ID is required'),
})

export async function saveDiscordIntegrationAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; botSecret?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = DiscordIntegrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { botToken, channelIds } = parsed.data
  const channelIdList = channelIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Verify token against Discord API before storing
  if (!MOCK_EXTERNALS) {
    const verify = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${botToken}` },
    })
    if (!verify.ok) {
      return { error: 'Discord rejected this token — check it and try again' }
    }
  }

  // Generate a new bot_secret only if one doesn't already exist
  const existing = getIntegration(orgId, 'discord')
  const botSecret = existing?.bot_secret ?? crypto.randomBytes(32).toString('hex')

  upsertIntegration({
    orgId,
    platform: 'discord',
    botToken,
    botSecret,
    channelIds: channelIdList,
  })

  refresh()

  // Return the secret so the user can configure their bot with it
  return { botSecret: existing?.bot_secret ? undefined : botSecret }
}

export async function deleteDiscordIntegrationAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  deleteIntegration(orgId, 'discord')
  refresh()
  return null
}

// ── Slack ─────────────────────────────────────────────────────────────────────

const SlackIntegrationSchema = z.object({
  botToken: z
    .string()
    .min(1, 'Bot token is required')
    .startsWith('xoxb-', 'Slack bot token must start with xoxb-'),
  signingSecret: z
    .string()
    .min(32, 'Signing secret appears too short — check Slack app Basic Information'),
  teamId: z
    .string()
    .regex(/^T[A-Z0-9]{8,}$/, 'Team ID must start with T followed by uppercase letters/numbers'),
  channelIds: z.string().min(1, 'At least one channel ID is required'),
})

export async function saveSlackIntegrationAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = SlackIntegrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { botToken, signingSecret, teamId, channelIds } = parsed.data
  const channelIdList = channelIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  upsertIntegration({
    orgId,
    platform: 'slack',
    botToken,
    webhookSecret: signingSecret,
    teamId,
    channelIds: channelIdList,
  })

  refresh()
  return null
}

export async function deleteSlackIntegrationAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  deleteIntegration(orgId, 'slack')
  refresh()
  return null
}
