import type { NextRequest } from 'next/server'
import { getTicketById, getTicketReplies, getTicketEvents, deleteTicket } from '@/lib/db/queries/tickets'
import { getAssessment } from '@/lib/db/queries/assessments'
import { auth } from '@/auth'
import { getOrgMembers } from '@/lib/db/queries/members'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

// Live data — never serve a cached snapshot.
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const ticket = getTicketById(Number(id))
  if (!ticket) return Response.json({ error: 'Not found' }, { status: 404 })

  const replies = getTicketReplies(Number(id))
  const events = getTicketEvents(Number(id))
  const assessment = getAssessment(Number(id))

  return Response.json({ ticket, replies, events, assessment })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = Number(session.user.id)
  const members = await getOrgMembers(DEFAULT_ORG_ID)
  const role = members.find((m) => m.user_id === userId)?.role
  if (role !== 'owner') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await ctx.params
  const ticketId = Number(id)

  const ticket = await getTicketById(ticketId)
  if (!ticket) return Response.json({ error: 'Not found' }, { status: 404 })

  await deleteTicket(ticketId)
  return new Response(null, { status: 204 })
}
