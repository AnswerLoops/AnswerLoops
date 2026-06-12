import { auth } from '@/auth'
import { getPendingInvitations } from '@/lib/db/queries/invitations'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const invites = getPendingInvitations(orgId)
  // Strip token from list response — client only needs id/email/role/expires_at + token for copy-link
  return Response.json(invites)
}
