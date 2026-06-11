'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { refresh } from 'next/cache'
import { auth } from '@/auth'
import { upsertIntegration, deleteIntegration, getIntegration } from '@/lib/db/queries/integrations'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const DiscordIntegrationSchema = z.object({
  botToken: z.string().min(1, 'Bot token is required'),
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
