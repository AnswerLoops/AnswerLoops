import crypto from 'crypto'
import { getDb } from '../index'

export interface WidgetOrg {
  id: number
  name: string
  widget_token: string
}

export function getOrgByWidgetToken(token: string): WidgetOrg | null {
  return (
    getDb()
      .prepare('SELECT id, name, widget_token FROM orgs WHERE widget_token = ?')
      .get(token) as WidgetOrg
  ) ?? null
}

export function ensureWidgetToken(orgId: number): string {
  const db = getDb()
  const row = db.prepare('SELECT widget_token FROM orgs WHERE id = ?').get(orgId) as { widget_token: string | null }
  if (row?.widget_token) return row.widget_token

  const token = crypto.randomBytes(24).toString('hex')
  db.prepare('UPDATE orgs SET widget_token = ? WHERE id = ?').run(token, orgId)
  return token
}
