import { eq, and } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { integrations, DEFAULT_ORG_ID } from '../schema'

export type Platform = 'discord' | 'slack'

export interface Integration {
  id: number
  org_id: number
  platform: string
  bot_token: string | null
  bot_secret: string | null
  channel_ids: string | null  // JSON array string
  team_id: string | null
  enabled: number
  created_at: string
  updated_at: string
}

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function getIntegration(orgId: number, platform: Platform): Integration | null {
  return (
    raw()
      .prepare('SELECT * FROM integrations WHERE org_id = ? AND platform = ?')
      .get(orgId, platform) as Integration
  ) ?? null
}

/** Look up which org owns a given bot_secret. Used by /api/ingest to route the request. */
export function getIntegrationByBotSecret(botSecret: string): Integration | null {
  return (
    raw()
      .prepare('SELECT * FROM integrations WHERE bot_secret = ? AND enabled = 1')
      .get(botSecret) as Integration
  ) ?? null
}

export function listIntegrations(orgId: number): Integration[] {
  return raw()
    .prepare('SELECT * FROM integrations WHERE org_id = ? ORDER BY platform ASC')
    .all(orgId) as Integration[]
}

export function upsertIntegration(input: {
  orgId: number
  platform: Platform
  botToken?: string | null
  botSecret?: string | null
  channelIds?: string[]
  teamId?: string | null
}): Integration {
  const channelIdsJson = input.channelIds ? JSON.stringify(input.channelIds) : null

  const existing = getIntegration(input.orgId, input.platform)
  if (existing) {
    raw()
      .prepare(
        `UPDATE integrations SET
           bot_token  = COALESCE(?, bot_token),
           bot_secret = COALESCE(?, bot_secret),
           channel_ids = COALESCE(?, channel_ids),
           team_id    = COALESCE(?, team_id),
           enabled    = 1,
           updated_at = datetime('now')
         WHERE org_id = ? AND platform = ?`
      )
      .run(
        input.botToken ?? null,
        input.botSecret ?? null,
        channelIdsJson ?? null,
        input.teamId ?? null,
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
      botToken: input.botToken ?? null,
      botSecret: input.botSecret ?? null,
      channelIds: channelIdsJson,
      teamId: input.teamId ?? null,
    })
    .run()

  return raw()
    .prepare('SELECT * FROM integrations WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Integration
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
