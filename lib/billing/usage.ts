import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle'
import { getSubscription } from '@/lib/db/queries/billing'
import { getMonthlyApiGenerations } from '@/lib/db/queries/api-generations'
import { getPlan, isOverLimit } from './plans'

export async function getMonthlyDeflections(orgId: number): Promise<number> {
  const db = getDb()
  const periodStart = new Date()
  periodStart.setDate(1)
  periodStart.setHours(0, 0, 0, 0)

  const [[row], apiGenerations] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM ai_assessments a
      JOIN tickets t ON t.id = a.ticket_id
      WHERE t.org_id = ${orgId}
        AND a.auto_deflected = 1
        AND t.created_at >= ${periodStart.toISOString()}
    `) as unknown as [{ n: number }],
    // generate_answer never creates a ticket, so its high-confidence calls
    // are tracked separately and folded into the same monthly count.
    getMonthlyApiGenerations(orgId, periodStart),
  ])

  return Number(row?.n ?? 0) + apiGenerations
}

export async function checkDeflectionLimit(orgId: number): Promise<{
  allowed: boolean
  used: number
  limit: number | null
  planId: string
}> {
  const [sub, used] = await Promise.all([
    getSubscription(orgId),
    getMonthlyDeflections(orgId),
  ])

  const status = sub?.status ?? 'active'
  const plan = getPlan(sub?.planId)

  // Canceled subscriptions lose access entirely
  if (status === 'canceled') {
    return { allowed: false, used, limit: 0, planId: plan.id }
  }

  // trialing / active / past_due all use the plan's deflection limit
  const allowed = !isOverLimit(used, plan)
  return { allowed, used, limit: plan.deflectionsPerMonth, planId: plan.id }
}
