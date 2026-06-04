interface StatsCardsProps {
  total: number
  open: number
  inProgress: number
  resolved: number
  slaBreaches: number
  pendingDrafts: number
  needsReview: number
  autoDeflected: number
}

export function StatsCards({ total, open, inProgress, resolved, slaBreaches, pendingDrafts, needsReview, autoDeflected }: StatsCardsProps) {
  const cards = [
    { label: 'Total Tickets', value: total, color: 'text-gray-900' },
    { label: 'Open', value: open, color: 'text-blue-600' },
    { label: 'In Progress', value: inProgress, color: 'text-yellow-600' },
    { label: 'Resolved', value: resolved, color: 'text-green-600' },
    { label: 'SLA Breaches', value: slaBreaches, color: slaBreaches > 0 ? 'text-red-600' : 'text-gray-900' },
    { label: 'AI Drafts Pending', value: pendingDrafts, color: pendingDrafts > 0 ? 'text-indigo-600' : 'text-gray-900' },
    { label: 'Needs Review', value: needsReview, color: needsReview > 0 ? 'text-amber-600' : 'text-gray-900' },
    { label: 'Auto-Answered', value: autoDeflected, color: autoDeflected > 0 ? 'text-green-600' : 'text-gray-900' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
