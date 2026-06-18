import { getTickets } from '@/lib/db/queries/tickets'
import { TicketList } from '@/components/tickets/ticket-list'
import type { TicketStatus, Priority, TicketCategory } from '@/types'

export const dynamic = 'force-dynamic'

interface SearchParams {
  status?: string
  priority?: string
  category?: string
}

export default async function TicketsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams
  const tickets = await getTickets({
    status: searchParams.status as TicketStatus | undefined,
    priority: searchParams.priority as Priority | undefined,
    category: searchParams.category as TicketCategory | undefined,
  })

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Filter bar */}
        <form className="flex items-center gap-2 text-sm">
          <select name="status" defaultValue={searchParams.status ?? ''} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 bg-white">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select name="priority" defaultValue={searchParams.priority ?? ''} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 bg-white">
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select name="category" defaultValue={searchParams.category ?? ''} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 bg-white">
            <option value="">All categories</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature Request</option>
            <option value="documentation">Documentation</option>
            <option value="how_to">How-to</option>
            <option value="general_question">General Question</option>
          </select>
          <button type="submit" className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
            Filter
          </button>
          <a href="/tickets" className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
            Clear
          </a>
        </form>
      </div>

      <TicketList tickets={tickets} />
    </div>
  )
}
