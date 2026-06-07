import type { NextRequest } from 'next/server'
import { getTicketById, getTicketReplies, getTicketEvents } from '@/lib/db/queries/tickets'
import { getAssessment } from '@/lib/db/queries/assessments'

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
