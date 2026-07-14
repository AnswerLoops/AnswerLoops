'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { refresh } from 'next/cache'
import { auth } from '@/auth'
import {
  upsertIntegration,
  deleteIntegration,
  getIntegration,
  getIntegrationByInboundAddress,
} from '@/lib/db/queries/integrations'
import { getOrg } from '@/lib/db/queries/orgs'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'

// Discord bot tokens: base64(snowflake).timestamp.hmac
const DISCORD_TOKEN_RE = /^[A-Za-z0-9_-]{20,30}\.[A-Za-z0-9_-]{4,8}\.[A-Za-z0-9_-]{25,50}$/

const DiscordIntegrationSchema = z.object({
  botToken: z.string().optional(),
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

  const { botToken, escalationRoleId, confidenceThreshold } = parsed.data

  // channelIds may come as checkboxes (multiple values) or a comma-separated string
  const rawChannelIds = formData.getAll('channelIds')
  const channelIdList = rawChannelIds
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean)

  if (channelIdList.length === 0) return { error: 'At least one channel is required' }

  const existing = await getIntegration(orgId, 'discord')
  const isOAuthConnected = !!existing?.connected_guild_id

  // OAuth-connected orgs use the platform bot — no per-org token needed
  if (!isOAuthConnected) {
    const newToken = botToken?.trim() || null
    if (!newToken && !existing?.bot_token) {
      return { error: 'Bot token is required' }
    }

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
  } else {
    // OAuth path — update channels/settings only, preserve existing guild linkage
    await upsertIntegration({
      orgId,
      platform: 'discord',
      channelIds: channelIdList,
      escalationRoleId: escalationRoleId?.trim() || null,
      confidenceThreshold: confidenceThreshold ?? null,
    })
  }

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
  // Optional in polling mode; required only if using Slack Events API webhooks
  signingSecret: z.string().optional(),
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
    webhookSecret: signingSecret ?? null,
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

export async function saveSlackChannelsAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const channelIds = String(formData.get('channelIds') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (channelIds.length === 0) return { error: 'Select at least one channel' }

  const escalationRoleId = String(formData.get('escalationRoleId') ?? '').trim() || null
  const confidenceThreshold = parseFloat(String(formData.get('confidenceThreshold') ?? '0.8'))

  await upsertIntegration({
    orgId,
    platform: 'slack',
    channelIds,
    escalationRoleId,
    confidenceThreshold: isNaN(confidenceThreshold) ? null : confidenceThreshold,
  })

  refresh()
  return null
}

// ── Telegram ──────────────────────────────────────────────────────────────────

// Telegram bot tokens: {digits}:{alphanumeric+hyphen} e.g. 123456789:AAHdqTcv...
const TELEGRAM_TOKEN_RE = /^\d{8,12}:[A-Za-z0-9_-]{35}$/

const TelegramIntegrationSchema = z.object({
  botToken: z.string().optional(),
  chatIds: z.string().optional(),
  escalationUsername: z.string().optional(),
  confidenceThreshold: z.coerce.number().min(0).max(1).optional(),
})

export async function saveTelegramIntegrationAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = TelegramIntegrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { botToken, chatIds, escalationUsername, confidenceThreshold } = parsed.data
  const chatIdList = (chatIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const existing = await getIntegration(orgId, 'telegram')

  const newToken = botToken?.trim() || null
  if (!newToken && !existing?.bot_token) {
    return { error: 'Bot token is required' }
  }

  if (newToken) {
    if (!TELEGRAM_TOKEN_RE.test(newToken)) {
      return { error: 'Invalid Telegram bot token format — should be: 123456789:AAHdqTcv...' }
    }
    if (!MOCK_EXTERNALS) {
      const verify = await fetch(`https://api.telegram.org/bot${newToken}/getMe`)
      if (!verify.ok) {
        return { error: 'Telegram rejected this token — check it and try again' }
      }
    }
  }

  const botSecret = existing?.bot_secret ?? crypto.randomBytes(32).toString('hex')

  await upsertIntegration({
    orgId,
    platform: 'telegram',
    botToken: newToken ?? undefined,
    botSecret,
    channelIds: chatIdList,
    escalationRoleId: escalationUsername?.trim() || null,
    confidenceThreshold: confidenceThreshold ?? null,
  })

  refresh()
  return null
}

export async function deleteTelegramIntegrationAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  await deleteIntegration(orgId, 'telegram')
  refresh()
  return null
}

// ── Email ─────────────────────────────────────────────────────────────────────

const EMAIL_INBOUND_DOMAIN = process.env.EMAIL_INBOUND_DOMAIN ?? 'inbox.answerloops.app'

function slugifyForEmail(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'org'
}

async function generateUniqueInboundAddress(base: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomBytes(3).toString('hex')
    const candidate = `${base}-${suffix}@${EMAIL_INBOUND_DOMAIN}`
    const taken = await getIntegrationByInboundAddress(candidate)
    if (!taken) return candidate
  }
  throw new Error('Could not generate a unique inbound address')
}

/**
 * Zero-setup email onboarding: generates a platform-hosted inbound address
 * and enables the integration immediately — no provider account, API key, or
 * DNS change required. This is the primary path; saveEmailIntegrationAction
 * below remains as the "Advanced: bring your own provider" disclosure.
 */
export async function connectPlatformEmailAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string; inboundAddress?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const existing = await getIntegration(orgId, 'email')
  // inbound_address is set once and is immutable — reconnecting must not churn it.
  if (existing?.inbound_address) {
    refresh()
    return { inboundAddress: existing.inbound_address }
  }

  const org = await getOrg(orgId)
  const base = slugifyForEmail(org?.slug || org?.name || `org-${orgId}`)
  const inboundAddress = await generateUniqueInboundAddress(base)

  await upsertIntegration({
    orgId,
    platform: 'email',
    inboundAddress,
    botSecret: existing?.bot_secret ?? crypto.randomBytes(32).toString('hex'),
    confidenceThreshold: existing?.confidence_threshold ?? 0.8,
  })

  refresh()
  return { inboundAddress }
}

const EmailIntegrationSchema = z.object({
  replyFromAddress: z.string().email('Invalid reply-from email address').optional().or(z.literal('')),
  allowedSenders: z.string().optional(),
  escalationEmail: z.string().optional(),
  confidenceThreshold: z.coerce.number().min(0).max(1).optional(),
})

export async function saveEmailIntegrationAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; webhookSecret?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = EmailIntegrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { replyFromAddress, allowedSenders, escalationEmail, confidenceThreshold } = parsed.data

  const senderList = (allowedSenders ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const existing = await getIntegration(orgId, 'email')
  // bot_secret used as the webhook verification secret — stable per org
  const botSecret = existing?.bot_secret ?? crypto.randomBytes(32).toString('hex')

  await upsertIntegration({
    orgId,
    platform: 'email',
    // bot_token stores the reply-from address
    botToken: replyFromAddress?.trim() || undefined,
    botSecret,
    channelIds: senderList,
    escalationRoleId: escalationEmail?.trim() || null,
    confidenceThreshold: confidenceThreshold ?? null,
  })

  refresh()
  // Return the secret so the UI can display it for webhook configuration
  return { webhookSecret: botSecret }
}

export async function deleteEmailIntegrationAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  await deleteIntegration(orgId, 'email')
  refresh()
  return null
}
