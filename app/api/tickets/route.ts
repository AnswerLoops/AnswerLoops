import { getTickets } from '@/lib/db/queries/tickets'
import type { TicketStatus, Priority, TicketCategory } from '@/types'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tickets = getTickets({
    status: url.searchParams.get('status') as TicketStatus | undefined ?? undefined,
    priority: url.searchParams.get('priority') as Priority | undefined ?? undefined,
    category: url.searchParams.get('category') as TicketCategory | undefined ?? undefined,
  })
  return Response.json(tickets)
}
