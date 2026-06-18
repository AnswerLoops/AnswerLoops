import { getTicketStats, getSLABreachedTickets, getTickets } from '@/lib/db/queries/tickets'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { SLABreachList } from '@/components/dashboard/sla-breach-list'
import Link from 'next/link'
import { StatusBadge, CategoryBadge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const stats = await getTicketStats()
  const breachedTickets = await getSLABreachedTickets()
  const recentTickets = (await getTickets({ status: 'open' })).slice(0, 5)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Community support overview</p>
      </div>

      <StatsCards {...stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">SLA Status</h2>
          <SLABreachList tickets={breachedTickets} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Open Tickets</h2>
          <div className="bg-white rounded-lg border border-gray-200">
            {recentTickets.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No open tickets</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/tickets/${ticket.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">
                          {ticket.ai_summary ?? ticket.content.slice(0, 80)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{ticket.discord_author_name} · #{ticket.id}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ticket.category && <CategoryBadge category={ticket.category} />}
                        <StatusBadge status={ticket.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-2 border-t border-gray-100">
              <Link href="/tickets" className="text-xs text-indigo-600 hover:underline">View all tickets →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
