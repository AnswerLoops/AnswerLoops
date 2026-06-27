import { eq, and } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { integrations } from '../schema'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

export type Platform = 'discord' | 'slack' | 'telegram'

export interface Integration {
  id: number
  org_id: number
  platform: string
  bot_token: string | null
  bot_secret: string | null
  channel_ids: string | null
  guild_channel_map: string | null
  team_id: string | null
  webhook_secret: string | null
  escalation_role_id: string | null
  confidence_threshold: number | null
  enabled: number
  created_at: string
  updated_at: string
}

function toIntegration(row: typeof integrations.$inferSelect): Integration {
  return {
    id: row.id,
    org_id: row.orgId,
    platform: row.platform,
    bot_token: row.botToken,
    bot_secret: row.botSecret,
    channel_ids: row.channelIds,
    guild_channel_map: row.guildChannelMap ?? null,
    team_id: row.teamId,
    webhook_secret: row.webhookSecret,
    escalation_role_id: row.escalationRoleId ?? null,
    confidence_threshold: row.confidenceThreshold ?? 0.8,
    enabled: row.enabled,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function decryptRow(row: Integration): Integration {
  return {
    ...row,
    bot_token: row.bot_token ? decryptToken(row.bot_token) : null,
    webhook_secret: row.webhook_secret ? decryptToken(row.webhook_secret) : null,
  }
}

export async function getIntegration(orgId: number, platform: Platform): Promise<Integration | null> {
  const [row] = await getDb()
    .select()
    .from(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.platform, platform)))
    .limit(1)
  return row ? decryptRow(toIntegration(row)) : null
}

export async function getIntegrationByBotSecret(botSecret: string): Promise<Integration | null> {
  const [row] = await getDb()
    .select()
    .from(integrations)
    .where(and(eq(integrations.botSecret, botSecret), eq(integrations.enabled, 1)))
    .limit(1)
  return row ? decryptRow(toIntegration(row)) : null
}

export async function getIntegrationByTeamId(teamId: string): Promise<Integration | null> {
  const [row] = await getDb()
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.teamId, teamId),
        eq(integrations.platform, 'slack'),
        eq(integrations.enabled, 1)
      )
    )
    .limit(1)
  return row ? decryptRow(toIntegration(row)) : null
}

export async function listIntegrations(orgId: number): Promise<Integration[]> {
  const rows = await getDb()
    .select()
    .from(integrations)
    .where(eq(integrations.orgId, orgId))
    .orderBy(integrations.platform)
  return rows.map((r) => decryptRow(toIntegration(r)))
}

export async function upsertIntegration(input: {
  orgId: number
  platform: Platform
  botToken?: string | null
  botSecret?: string | null
  channelIds?: string[]
  teamId?: string | null
  webhookSecret?: string | null
  escalationRoleId?: string | null
  confidenceThreshold?: number | null
}): Promise<Integration> {
  const channelIdsJson = input.channelIds ? JSON.stringify(input.channelIds) : null
  const encryptedBotToken = input.botToken ? encryptToken(input.botToken) : null
  const encryptedWebhookSecret = input.webhookSecret ? encryptToken(input.webhookSecret) : null

  const existing = await getIntegration(input.orgId, input.platform)
  if (existing) {
    await getDb()
      .update(integrations)
      .set({
        botToken: encryptedBotToken ?? undefined,
        botSecret: input.botSecret ?? undefined,
        channelIds: channelIdsJson ?? undefined,
        teamId: input.teamId ?? undefined,
        webhookSecret: encryptedWebhookSecret ?? undefined,
        escalationRoleId: input.escalationRoleId !== undefined ? (input.escalationRoleId ?? null) : undefined,
        confidenceThreshold: input.confidenceThreshold !== undefined ? (input.confidenceThreshold ?? 0.8) : undefined,
        enabled: 1,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(integrations.orgId, input.orgId), eq(integrations.platform, input.platform)))
    return (await getIntegration(input.orgId, input.platform))!
  }

  const [row] = await getDb()
    .insert(integrations)
    .values({
      orgId: input.orgId,
      platform: input.platform,
      botToken: encryptedBotToken,
      botSecret: input.botSecret ?? null,
      channelIds: channelIdsJson,
      teamId: input.teamId ?? null,
      webhookSecret: encryptedWebhookSecret ?? null,
      escalationRoleId: input.escalationRoleId ?? null,
      confidenceThreshold: input.confidenceThreshold ?? 0.8,
    })
    .returning()

  return decryptRow(toIntegration(row))
}

export async function disableIntegration(orgId: number, platform: Platform): Promise<void> {
  await getDb()
    .update(integrations)
    .set({ enabled: 0, updatedAt: new Date().toISOString() })
    .where(and(eq(integrations.orgId, orgId), eq(integrations.platform, platform)))
}

export async function deleteIntegration(orgId: number, platform: Platform): Promise<void> {
  await getDb()
    .delete(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.platform, platform)))
}

export function parseChannelIds(integration: Integration): string[] {
  if (!integration.channel_ids) return []
  try {
    return JSON.parse(integration.channel_ids) as string[]
  } catch {
    return []
  }
}

/** Returns a map of { channelId → guildId } built from the bot's connected guilds. */
export function parseGuildChannelMap(integration: Integration): Record<string, string> {
  if (!integration.guild_channel_map) return {}
  try {
    return JSON.parse(integration.guild_channel_map) as Record<string, string>
  } catch {
    return {}
  }
}

export async function saveGuildChannelMap(
  orgId: number,
  map: Record<string, string>
): Promise<void> {
  await getDb()
    .update(integrations)
    .set({ guildChannelMap: JSON.stringify(map), updatedAt: new Date().toISOString() })
    .where(and(eq(integrations.orgId, orgId), eq(integrations.platform, 'discord')))
}
