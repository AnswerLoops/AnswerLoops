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

// ROI bundle: the numbers that prove the platform's value over time.
export async function GET() {
  const stats = await getDeflectionStats()
  return Response.json({
    stats,
    rate: deflectionRate(stats.deflected, stats.answered),
    savings: computeSavings(stats.deflected),
    trend: await getDeflectionTrend(),
    categories: await getCategoryBreakdown(),
    docGaps: await getDocGaps(),
    sla: await getSLAStats(),
    accuracy: await getDeflectionAccuracyByCategory(),
  })
}
