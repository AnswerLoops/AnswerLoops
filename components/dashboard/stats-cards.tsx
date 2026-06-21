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

interface CardConfig {
  label: string
  value: number
  icon: React.ReactNode
  bg: string
  iconBg: string
  valueColor: string
  highlight?: boolean
}

export function StatsCards({ total, open, inProgress, resolved, slaBreaches, pendingDrafts, needsReview, autoDeflected }: StatsCardsProps) {
  const deflectionRate = total > 0 ? Math.round((autoDeflected / total) * 100) : 0

  const cards: CardConfig[] = [
    {
      label: 'Auto-Answered',
      value: autoDeflected,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      bg: 'bg-green-50 border-green-100',
      iconBg: 'bg-green-100 text-green-600',
      valueColor: 'text-green-700',
      highlight: true,
    },
    {
      label: 'Deflection Rate',
      value: deflectionRate,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
      bg: 'bg-indigo-50 border-indigo-100',
      iconBg: 'bg-indigo-100 text-indigo-600',
      valueColor: 'text-indigo-700',
    },
    {
      label: 'Open',
      value: open,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
      bg: 'bg-blue-50 border-blue-100',
      iconBg: 'bg-blue-100 text-blue-600',
      valueColor: 'text-blue-700',
    },
    {
      label: 'In Progress',
      value: inProgress,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      ),
      bg: 'bg-amber-50 border-amber-100',
      iconBg: 'bg-amber-100 text-amber-600',
      valueColor: 'text-amber-700',
    },
    {
      label: 'Resolved',
      value: resolved,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
        </svg>
      ),
      bg: 'bg-emerald-50 border-emerald-100',
      iconBg: 'bg-emerald-100 text-emerald-600',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'Needs Review',
      value: needsReview,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      bg: needsReview > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100',
      iconBg: needsReview > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400',
      valueColor: needsReview > 0 ? 'text-orange-700' : 'text-gray-500',
    },
    {
      label: 'AI Drafts Pending',
      value: pendingDrafts,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      bg: pendingDrafts > 0 ? 'bg-violet-50 border-violet-100' : 'bg-gray-50 border-gray-100',
      iconBg: pendingDrafts > 0 ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400',
      valueColor: pendingDrafts > 0 ? 'text-violet-700' : 'text-gray-500',
    },
    {
      label: 'SLA Breaches',
      value: slaBreaches,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      bg: slaBreaches > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',
      iconBg: slaBreaches > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400',
      valueColor: slaBreaches > 0 ? 'text-red-700' : 'text-gray-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.iconBg}`}>
              {card.icon}
            </div>
          </div>
          <p className={`text-2xl font-bold ${card.valueColor}`}>
            {card.label === 'Deflection Rate' ? `${card.value}%` : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
