import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { orgs } from '../schema'

export interface WidgetOrg {
  id: number
  name: string
  widget_token: string
}

export interface WidgetTokenInfo {
  token: string
  expiresAt: string
}

const TOKEN_TTL_DAYS = 90

function expiryFromNow(): string {
  const d = new Date()
  d.setDate(d.getDate() + TOKEN_TTL_DAYS)
  return d.toISOString()
}

export async function getOrgByWidgetToken(token: string): Promise<WidgetOrg | null> {
  const [row] = await getDb()
    .select({
      id: orgs.id,
      name: orgs.name,
      widget_token: orgs.widgetToken,
      widget_token_expires_at: orgs.widgetTokenExpiresAt,
    })
    .from(orgs)
    .where(eq(orgs.widgetToken, token))
    .limit(1)

  if (!row) return null
  if (row.widget_token_expires_at && new Date(row.widget_token_expires_at) < new Date()) return null
  return { id: row.id, name: row.name, widget_token: row.widget_token! }
}

export async function ensureWidgetToken(orgId: number): Promise<WidgetTokenInfo> {
  const [row] = await getDb()
    .select({ widgetToken: orgs.widgetToken, widgetTokenExpiresAt: orgs.widgetTokenExpiresAt })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1)

  if (row?.widgetToken && row.widgetTokenExpiresAt && new Date(row.widgetTokenExpiresAt) > new Date()) {
    return { token: row.widgetToken, expiresAt: row.widgetTokenExpiresAt }
  }

  return rotateWidgetToken(orgId)
}

export async function rotateWidgetToken(orgId: number): Promise<WidgetTokenInfo> {
  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = expiryFromNow()
  await getDb()
    .update(orgs)
    .set({ widgetToken: token, widgetTokenExpiresAt: expiresAt })
    .where(eq(orgs.id, orgId))
  return { token, expiresAt }
}
