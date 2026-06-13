'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { Resend } from 'resend'
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

  // Send email if RESEND_API_KEY is configured; skip silently in dev/test
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const db = getDb()
    const org = db.prepare('SELECT name FROM orgs WHERE id = ?').get(orgId) as { name: string } | null
    const inviter = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId) as { name: string | null; email: string | null } | null
    const orgName = org?.name ?? 'a workspace'
    const inviterName = inviter?.name ?? inviter?.email ?? 'Someone'
    const fromAddress = process.env.RESEND_FROM ?? 'invites@yourdomain.com'

    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `${inviterName} invited you to ${orgName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:600;color:#111827;margin-bottom:8px">
            You're invited to join ${orgName}
          </h2>
          <p style="color:#6b7280;font-size:14px;margin-bottom:24px">
            ${inviterName} has invited you to join their workspace on Community Platform as a <strong>${role}</strong>.
            This invite expires in ${INVITE_TTL_DAYS} days.
          </p>
          <a href="${inviteUrl}"
             style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none">
            Accept invitation
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">
            Or copy this link: ${inviteUrl}
          </p>
        </div>
      `,
    })
  }

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

export async function transferOwnershipAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const currentUserId = Number(session.user.id)

  const targetMembershipId = Number(formData.get('membershipId'))
  const targetUserId = Number(formData.get('userId'))
  if (!targetMembershipId || !targetUserId) return { error: 'Missing target member.' }
  if (targetUserId === currentUserId) return { error: "Can't transfer to yourself." }

  const db = getDb()

  const currentMembership = db
    .prepare('SELECT id, role FROM memberships WHERE user_id = ? AND org_id = ?')
    .get(currentUserId, orgId) as { id: number; role: string } | null
  if (currentMembership?.role !== 'owner') return { error: 'Only owners can transfer ownership.' }

  const target = db
    .prepare('SELECT role FROM memberships WHERE id = ? AND org_id = ?')
    .get(targetMembershipId, orgId) as { role: string } | null
  if (!target) return { error: 'Member not found.' }

  db.transaction(() => {
    db.prepare('UPDATE memberships SET role = ? WHERE id = ? AND org_id = ?').run('member', currentMembership.id, orgId)
    db.prepare('UPDATE memberships SET role = ? WHERE id = ? AND org_id = ?').run('owner', targetMembershipId, orgId)
  })()

  refresh()
  return null
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

  const target = getDb()
    .prepare('SELECT role FROM memberships WHERE id = ? AND org_id = ?')
    .get(membershipId, orgId) as { role: string } | null
  if (target?.role === 'owner') return { error: "Owners cannot be removed." }

  getDb()
    .prepare('DELETE FROM memberships WHERE id = ? AND org_id = ?')
    .run(membershipId, orgId)

  refresh()
  return null
}
