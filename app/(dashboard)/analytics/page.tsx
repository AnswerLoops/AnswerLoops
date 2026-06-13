import Link from 'next/link'
import {
  getDeflectionStats,
  getDeflectionTrend,
  getCategoryBreakdown,
  getDocGaps,
  getSLAStats,
} from '@/lib/db/queries/analytics'
import { getDeflectionAccuracyByCategory } from '@/lib/db/queries/feedback'
import { computeSavings, deflectionRate } from '@/lib/analytics/roi'

export const dynamic = 'force-dynamic'

const pct = (n: number) => `${Math.round(n * 100)}%`
const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const hours = (n: number) => `${n.toFixed(1)}h`

function Bar({ value, max, className = 'bg-indigo-500' }: { value: number; max: number; className?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 flex-1 rounded-full bg-gray-100">
      <div className={`h-2 rounded-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export default function AnalyticsPage() {
  const stats = getDeflectionStats()
  const rate = deflectionRate(stats.deflected, stats.answered)
  const savings = computeSavings(stats.deflected)
  const trend = getDeflectionTrend()
  const categories = getCategoryBreakdown()
  const docGaps = getDocGaps()
  const sla = getSLAStats()
  const accuracyByCategory = getDeflectionAccuracyByCategory()

  const trendMax = Math.max(1, ...trend.map((t) => t.answered))
  const catMax = Math.max(1, ...categories.map((c) => c.count))
  const responseTotal = sla.responseMet + sla.responseBreached

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">How much the platform is deflecting — and what it's worth</p>
      </div>

      {/* Hero ROI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">Staff time saved</p>
          <p className="mt-1 text-3xl font-bold text-green-800">{hours(savings.hoursSaved)}</p>
          <p className="text-xs text-green-700/80 mt-1">≈ {money(savings.dollarsSaved)} at {money(savings.hourlyRate)}/hr</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Deflection rate</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{pct(rate)}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.deflected} of {stats.answered} answered auto-resolved</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Questions handled</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{stats.totalTickets}</p>
          <p className="text-xs text-gray-500 mt-1">{savings.minutesPerTicket} min saved per deflection</p>
        </div>
      </div>

      {/* Deflection trend */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Deflection trend (last {trend.length || 0} days)</h2>
        {trend.length === 0 ? (
          <p className="text-sm text-gray-400">No answered questions yet.</p>
        ) : (
          <ul className="space-y-2">
            {trend.map((t) => (
              <li key={t.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-gray-400">{t.day.slice(5)}</span>
                <Bar value={t.deflected} max={trendMax} className="bg-green-500" />
                <span className="w-24 shrink-0 text-right text-gray-500">
                  {t.deflected}/{t.answered} deflected
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trending topics */}
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Trending topics</h2>
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.category} className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0 capitalize text-gray-600">{c.category.replace(/_/g, ' ')}</span>
                <Bar value={c.count} max={catMax} />
                <span className="w-6 shrink-0 text-right text-gray-500">{c.count}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* SLA attainment */}
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">SLA & responsiveness</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Response SLA met</dt>
              <dd className="font-medium text-gray-900">
                {responseTotal > 0 ? pct(sla.responseMet / responseTotal) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg. time to first response</dt>
              <dd className="font-medium text-gray-900">
                {sla.avgFirstResponseMinutes != null ? `${Math.round(sla.avgFirstResponseMinutes)} min` : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">SLA breaches</dt>
              <dd className="font-medium text-gray-900">{sla.responseBreached + sla.resolveBreached}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Answer quality by category */}
      {accuracyByCategory.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Answer quality by category</h2>
          <p className="text-xs text-gray-400 mb-3">
            👍/👎 feedback on auto-deflected answers, broken down by topic.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium text-right">Deflected</th>
                  <th className="pb-2 font-medium text-right">👍</th>
                  <th className="pb-2 font-medium text-right">👎</th>
                  <th className="pb-2 font-medium text-right">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {accuracyByCategory.map((row) => {
                  const rated = row.positive + row.negative
                  const approval = rated > 0 ? row.positive / rated : null
                  return (
                    <tr key={row.category}>
                      <td className="py-2 capitalize text-gray-700">{row.category.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right text-gray-500">{row.deflected}</td>
                      <td className="py-2 text-right text-green-600">{row.positive}</td>
                      <td className="py-2 text-right text-red-500">{row.negative}</td>
                      <td className="py-2 text-right">
                        {approval === null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={approval >= 0.7 ? 'text-green-600 font-medium' : approval >= 0.4 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'}>
                            {pct(approval)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Documentation gaps */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Documentation gaps</h2>
        <p className="text-xs text-gray-400 mb-3">
          Resolved how-to / documentation questions not yet promoted to the knowledge base.
        </p>
        {docGaps.length === 0 ? (
          <p className="text-sm text-gray-400">No gaps — every resolved how-to is in the KB. 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {docGaps.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-gray-400">#{g.id}</span>
                <Link href={`/tickets/${g.id}`} className="text-gray-700 hover:text-indigo-600 line-clamp-1">
                  {g.summary}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
