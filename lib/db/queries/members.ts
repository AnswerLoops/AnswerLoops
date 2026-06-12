import { getDb } from '@/lib/db/index'

export interface Member {
  membership_id: number
  user_id: number
  org_id: number
  role: string
  joined_at: string
  email: string | null
  name: string | null
  image: string | null
}

export function getOrgMembers(orgId: number): Member[] {
  return getDb()
    .prepare(
      `SELECT m.id AS membership_id, m.user_id, m.org_id, m.role, m.created_at AS joined_at,
              u.email, u.name, u.image
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(orgId) as Member[]
}

export function removeMember(membershipId: number, orgId: number): void {
  getDb()
    .prepare('DELETE FROM memberships WHERE id = ? AND org_id = ?')
    .run(membershipId, orgId)
}

export function addMember(userId: number, orgId: number, role: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO memberships (user_id, org_id, role) VALUES (?, ?, ?)`
    )
    .run(userId, orgId, role)
}

export function isMember(userId: number, orgId: number): boolean {
  const row = getDb()
    .prepare('SELECT id FROM memberships WHERE user_id = ? AND org_id = ?')
    .get(userId, orgId)
  return !!row
}
