import { auth } from '@/auth'
import { getResolvedTicketsThisWeek, insertFAQSnapshot } from '@/lib/db/queries/faq'
import { generateFAQ } from '@/lib/ai/faq-generator'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export async function POST() {
  const session = await auth()
  const orgId = session?.orgId ?? DEFAULT_ORG_ID

  const tickets = await getResolvedTicketsThisWeek()

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // Sunday

  const content = await generateFAQ(tickets, orgId)
  const snapshot = await insertFAQSnapshot(
    weekStart.toISOString().split('T')[0],
    weekEnd.toISOString().split('T')[0],
    content,
    tickets.length
  )

  return Response.json({ ok: true, snapshot_id: snapshot.id, ticket_count: tickets.length })
}
