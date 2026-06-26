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
  botToken: z.string().optional(),
  channelIds: z.string().min(1, 'At least one channel ID is required'),
  escalationRoleId: z.string().optional(),
  confidenceThreshold: z.coerce.number().min(0).max(1).optional(),
})

export async function saveDiscordIntegrationAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = DiscordIntegrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { botToken, channelIds, escalationRoleId, confidenceThreshold } = parsed.data
  const channelIdList = channelIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const existing = await getIntegration(orgId, 'discord')

  // Require token on first connect; allow blank to keep existing on update
  const newToken = botToken?.trim() || null
  if (!newToken && !existing?.bot_token) {
    return { error: 'Bot token is required' }
  }

  // Only validate token format and verify with Discord if a new one was provided
  if (newToken) {
    if (!DISCORD_TOKEN_RE.test(newToken)) {
      return { error: 'Invalid Discord bot token format' }
    }
    if (!MOCK_EXTERNALS) {
      const verify = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${newToken}` },
      })
      if (!verify.ok) {
        return { error: 'Discord rejected this token — check it and try again' }
      }
    }
  }

  const botSecret = existing?.bot_secret ?? crypto.randomBytes(32).toString('hex')

  await upsertIntegration({
    orgId,
    platform: 'discord',
    botToken: newToken ?? undefined,
    botSecret,
    channelIds: channelIdList,
    escalationRoleId: escalationRoleId?.trim() || null,
    confidenceThreshold: confidenceThreshold ?? null,
  })

  refresh()

  return null
}

export async function deleteDiscordIntegrationAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  await deleteIntegration(orgId, 'discord')
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
  escalationRoleId: z.string().optional(),
  confidenceThreshold: z.coerce.number().min(0).max(1).optional(),
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

  const { botToken, signingSecret, teamId, channelIds, escalationRoleId, confidenceThreshold } = parsed.data
  const channelIdList = channelIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  await upsertIntegration({
    orgId,
    platform: 'slack',
    botToken,
    webhookSecret: signingSecret,
    teamId,
    channelIds: channelIdList,
    escalationRoleId: escalationRoleId?.trim() || null,
    confidenceThreshold: confidenceThreshold ?? null,
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

  await deleteIntegration(orgId, 'slack')
  refresh()
  return null
}
