import crypto from 'crypto'
import { getDb } from '../index'

export interface WidgetOrg {
  id: number
  name: string
  widget_token: string
}

export interface WidgetTokenInfo {
  token: string
  expiresAt: string // ISO string
}

const TOKEN_TTL_DAYS = 90

function expiryFromNow(): string {
  const d = new Date()
  d.setDate(d.getDate() + TOKEN_TTL_DAYS)
  return d.toISOString()
}

export function getOrgByWidgetToken(token: string): WidgetOrg | null {
  const row = getDb()
    .prepare('SELECT id, name, widget_token, widget_token_expires_at FROM orgs WHERE widget_token = ?')
    .get(token) as (WidgetOrg & { widget_token_expires_at: string | null }) | undefined

  if (!row) return null
  if (row.widget_token_expires_at && new Date(row.widget_token_expires_at) < new Date()) return null
  return row
}

export function ensureWidgetToken(orgId: number): WidgetTokenInfo {
  const db = getDb()
  const row = db
    .prepare('SELECT widget_token, widget_token_expires_at FROM orgs WHERE id = ?')
    .get(orgId) as { widget_token: string | null; widget_token_expires_at: string | null }

  // Return existing token if still valid
  if (row?.widget_token && row.widget_token_expires_at && new Date(row.widget_token_expires_at) > new Date()) {
    return { token: row.widget_token, expiresAt: row.widget_token_expires_at }
  }

  return rotateWidgetToken(orgId)
}

export function rotateWidgetToken(orgId: number): WidgetTokenInfo {
  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = expiryFromNow()
  getDb()
    .prepare('UPDATE orgs SET widget_token = ?, widget_token_expires_at = ? WHERE id = ?')
    .run(token, expiresAt, orgId)
  return { token, expiresAt }
}
