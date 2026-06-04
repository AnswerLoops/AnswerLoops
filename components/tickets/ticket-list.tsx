import Link from 'next/link'
import type { Ticket } from '@/types'
import { StatusBadge, PriorityBadge, CategoryBadge, AIDraftBadge } from '@/components/ui/badge'
import { getSLAStatus } from '@/lib/sla/engine'

function SLAIndicator({ ticket }: { ticket: Ticket }) {
  const sla = getSLAStatus(ticket)
  if (!sla.anyBreached) return null
  return <span className="text-xs font-medium text-red-600">SLA breach</span>
}

export function TicketList({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-sm text-gray-500">
        No tickets found.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 font-medium">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Summary</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Priority</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">AI</th>
            <th className="px-4 py-2.5">SLA</th>
            <th className="px-4 py-2.5">Author</th>
            <th className="px-4 py-2.5">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-400">#{ticket.id}</td>
              <td className="px-4 py-3 max-w-xs">
                <Link href={`/tickets/${ticket.id}`} className="text-gray-900 hover:text-indigo-600 line-clamp-2">
                  {ticket.ai_summary ?? ticket.content.slice(0, 100)}
                </Link>
              </td>
              <td className="px-4 py-3">
                {ticket.category && <CategoryBadge category={ticket.category} />}
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3">
                <AIDraftBadge status={ticket.ai_draft_status} />
              </td>
              <td className="px-4 py-3">
                <SLAIndicator ticket={ticket} />
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">{ticket.discord_author_name ?? '—'}</td>
              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                {new Date(ticket.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
