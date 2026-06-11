import { getDb } from '@/lib/db/index'

export interface Org {
  id: number
  name: string
  slug: string | null
  onboarded_at: string | null
  created_at: string
}

export function getOrg(orgId: number): Org | null {
  return (getDb().prepare('SELECT * FROM orgs WHERE id = ?').get(orgId) as Org | undefined) ?? null
}

export function updateOrgName(orgId: number, name: string): void {
  getDb().prepare('UPDATE orgs SET name = ? WHERE id = ?').run(name, orgId)
}

export function setOrgOnboarded(orgId: number): void {
  getDb()
    .prepare("UPDATE orgs SET onboarded_at = datetime('now') WHERE id = ? AND onboarded_at IS NULL")
    .run(orgId)
}

export function isOrgOnboarded(orgId: number): boolean {
  const row = getDb()
    .prepare('SELECT onboarded_at FROM orgs WHERE id = ?')
    .get(orgId) as { onboarded_at: string | null } | undefined
  return !!row?.onboarded_at
}
