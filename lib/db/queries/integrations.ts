import { eq, and } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { integrations, DEFAULT_ORG_ID } from '../schema'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

export type Platform = 'discord' | 'slack'

export interface Integration {
  id: number
  org_id: number
  platform: string
  bot_token: string | null
  bot_secret: string | null
  channel_ids: string | null  // JSON array string
  team_id: string | null
  webhook_secret: string | null
  enabled: number
  created_at: string
  updated_at: string
}

function dz() { return getDrizzle() }
function raw() { return getDb() }

function decryptRow(row: Integration): Integration {
  return {
    ...row,
    bot_token: row.bot_token ? decryptToken(row.bot_token) : null,
    webhook_secret: row.webhook_secret ? decryptToken(row.webhook_secret) : null,
  }
}

export function getIntegration(orgId: number, platform: Platform): Integration | null {
  const row = (
    raw()
      .prepare('SELECT * FROM integrations WHERE org_id = ? AND platform = ?')
      .get(orgId, platform) as Integration
  ) ?? null
  return row ? decryptRow(row) : null
}

/** Look up which org owns a given bot_secret. Used by /api/ingest to route Discord requests. */
export function getIntegrationByBotSecret(botSecret: string): Integration | null {
  const row = (
    raw()
      .prepare('SELECT * FROM integrations WHERE bot_secret = ? AND enabled = 1')
      .get(botSecret) as Integration
  ) ?? null
  return row ? decryptRow(row) : null
}

/** Look up which org owns a given Slack team_id. Used by /api/slack/events to route requests. */
export function getIntegrationByTeamId(teamId: string): Integration | null {
  const row = (
    raw()
      .prepare("SELECT * FROM integrations WHERE team_id = ? AND platform = 'slack' AND enabled = 1")
      .get(teamId) as Integration
  ) ?? null
  return row ? decryptRow(row) : null
}

export function listIntegrations(orgId: number): Integration[] {
  const rows = raw()
    .prepare('SELECT * FROM integrations WHERE org_id = ? ORDER BY platform ASC')
    .all(orgId) as Integration[]
  return rows.map(decryptRow)
}

export function upsertIntegration(input: {
  orgId: number
  platform: Platform
  botToken?: string | null
  botSecret?: string | null
  channelIds?: string[]
  teamId?: string | null
  webhookSecret?: string | null
}): Integration {
  const channelIdsJson = input.channelIds ? JSON.stringify(input.channelIds) : null
  const encryptedBotToken = input.botToken ? encryptToken(input.botToken) : null
  const encryptedWebhookSecret = input.webhookSecret ? encryptToken(input.webhookSecret) : null

  const existing = getIntegration(input.orgId, input.platform)
  if (existing) {
    raw()
      .prepare(
        `UPDATE integrations SET
           bot_token      = COALESCE(?, bot_token),
           bot_secret     = COALESCE(?, bot_secret),
           channel_ids    = COALESCE(?, channel_ids),
           team_id        = COALESCE(?, team_id),
           webhook_secret = COALESCE(?, webhook_secret),
           enabled        = 1,
           updated_at     = datetime('now')
         WHERE org_id = ? AND platform = ?`
      )
      .run(
        encryptedBotToken,
        input.botSecret ?? null,
        channelIdsJson ?? null,
        input.teamId ?? null,
        encryptedWebhookSecret,
        input.orgId,
        input.platform
      )
    return getIntegration(input.orgId, input.platform)!
  }

  const result = dz()
    .insert(integrations)
    .values({
      orgId: input.orgId,
      platform: input.platform,
      botToken: encryptedBotToken,
      botSecret: input.botSecret ?? null,
      channelIds: channelIdsJson,
      teamId: input.teamId ?? null,
      webhookSecret: encryptedWebhookSecret ?? null,
    })
    .run()

  return decryptRow(
    raw()
      .prepare('SELECT * FROM integrations WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as Integration
  )
}

export function disableIntegration(orgId: number, platform: Platform): void {
  dz()
    .update(integrations)
    .set({ enabled: 0, updatedAt: new Date().toISOString() })
    .where(and(eq(integrations.orgId, orgId), eq(integrations.platform, platform)))
    .run()
}

export function deleteIntegration(orgId: number, platform: Platform): void {
  raw()
    .prepare('DELETE FROM integrations WHERE org_id = ? AND platform = ?')
    .run(orgId, platform)
}

/** Parse channel_ids JSON field into a string array. */
export function parseChannelIds(integration: Integration): string[] {
  if (!integration.channel_ids) return []
  try {
    return JSON.parse(integration.channel_ids) as string[]
  } catch {
    return []
  }
}
