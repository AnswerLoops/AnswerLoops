import { getDb } from '@/lib/db/index'

export interface Invitation {
  id: number
  org_id: number
  email: string
  role: string
  token: string
  invited_by: number | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export function createInvitation(input: {
  orgId: number
  email: string
  role: string
  token: string
  invitedBy: number
  expiresAt: string
}): Invitation {
  const db = getDb()
  // Replace any existing pending invite for the same email+org
  db.prepare(
    `DELETE FROM invitations WHERE org_id = ? AND email = ? AND accepted_at IS NULL`
  ).run(input.orgId, input.email)

  const result = db.prepare(
    `INSERT INTO invitations (org_id, email, role, token, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`
  ).get(input.orgId, input.email, input.role, input.token, input.invitedBy, input.expiresAt) as Invitation

  return result
}

export function getInvitationByToken(token: string): Invitation | null {
  return (
    (getDb()
      .prepare('SELECT * FROM invitations WHERE token = ?')
      .get(token) as Invitation | undefined) ?? null
  )
}

export function getPendingInvitations(orgId: number): Invitation[] {
  return getDb()
    .prepare(
      `SELECT * FROM invitations
       WHERE org_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC`
    )
    .all(orgId) as Invitation[]
}

export function acceptInvitation(token: string): void {
  getDb()
    .prepare(`UPDATE invitations SET accepted_at = datetime('now') WHERE token = ?`)
    .run(token)
}

export function revokeInvitation(id: number, orgId: number): void {
  getDb()
    .prepare(`DELETE FROM invitations WHERE id = ? AND org_id = ?`)
    .run(id, orgId)
}
