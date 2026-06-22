import { auth } from '@/auth'
import { getTickets } from '@/lib/db/queries/tickets'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const tickets = await getTickets({}, orgId)

  const header = ['id', 'status', 'priority', 'category', 'ai_summary', 'content', 'discord_author_name', 'created_at', 'resolved_at']
  const rows = tickets.map((t) => [
    t.id,
    t.status,
    t.priority,
    t.category ?? '',
    t.ai_summary ?? '',
    t.content,
    t.discord_author_name ?? '',
    t.created_at,
    t.resolved_at ?? '',
  ].map(escapeCSV).join(','))

  const csv = [header.join(','), ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="tickets-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
