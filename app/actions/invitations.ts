'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { auth, unstable_update } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  revokeInvitation,
} from '@/lib/db/queries/invitations'
import { addMember, isMember } from '@/lib/db/queries/members'
import { getDb } from '@/lib/db/index'

const INVITE_TTL_DAYS = 7

const InviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'member']).default('member'),
})

export async function sendInviteAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; inviteUrl?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const userId = Number(session.user.id)

  const parsed = InviteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, role } = parsed.data

  // Don't invite someone who's already a member
  const existingUser = getDb()
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email) as { id: number } | null
  if (existingUser && isMember(existingUser.id, orgId)) {
    return { error: 'This person is already a member of your workspace.' }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)

  createInvitation({ orgId, email, role, token, invitedBy: userId, expiresAt })

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/invite/${token}`

  refresh()
  return { inviteUrl }
}

export async function revokeInviteAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const id = Number(formData.get('id'))
  if (!id) return { error: 'Missing invite ID' }

  revokeInvitation(id, orgId)
  refresh()
  return null
}

export async function acceptInviteAction(token: string): Promise<void> {
  const session = await auth()
  if (!session?.user) redirect(`/login?callbackUrl=/invite/${token}`)

  const invite = getInvitationByToken(token)
  if (!invite || invite.accepted_at) {
    redirect(`/invite/${token}?error=invalid`)
  }

  const db = getDb()
  const now = db.prepare("SELECT datetime('now') AS t").get() as { t: string }
  if (invite.expires_at < now.t) {
    redirect(`/invite/${token}?error=expired`)
  }

  const userId = Number(session.user.id)

  if (isMember(userId, invite.org_id)) {
    redirect('/dashboard')
  }

  // Add to the invited org
  addMember(userId, invite.org_id, invite.role)
  acceptInvitation(token)

  // Clean up the user's empty personal org if it was freshly created (unboarded, no data)
  const currentOrgId = session.orgId ?? DEFAULT_ORG_ID
  if (currentOrgId !== invite.org_id && currentOrgId !== DEFAULT_ORG_ID) {
    const hasData = db
      .prepare('SELECT COUNT(*) AS c FROM tickets WHERE org_id = ?')
      .get(currentOrgId) as { c: number }
    const currentOrg = db
      .prepare('SELECT onboarded_at FROM orgs WHERE id = ?')
      .get(currentOrgId) as { onboarded_at: string | null } | undefined
    if (!currentOrg?.onboarded_at && hasData.c === 0) {
      db.prepare('DELETE FROM memberships WHERE user_id = ? AND org_id = ?').run(userId, currentOrgId)
      db.prepare('DELETE FROM orgs WHERE id = ?').run(currentOrgId)
    }
  }

  // Update session to point at the invited org
  await unstable_update({ orgId: invite.org_id })
  redirect('/dashboard')
}

export async function removeMemberAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const currentUserId = Number(session.user.id)

  const membershipId = Number(formData.get('membershipId'))
  const targetUserId = Number(formData.get('userId'))

  if (targetUserId === currentUserId) return { error: "You can't remove yourself." }

  getDb()
    .prepare('DELETE FROM memberships WHERE id = ? AND org_id = ?')
    .run(membershipId, orgId)

  refresh()
  return null
}
