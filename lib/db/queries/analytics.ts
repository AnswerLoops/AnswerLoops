import { sql } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { DEFAULT_ORG_ID } from '../schema'

export interface DeflectionStats {
  totalTickets: number
  answered: number
  deflected: number
}

export async function getDeflectionStats(orgId = DEFAULT_ORG_ID): Promise<DeflectionStats> {
  const db = getDb()

  const [totRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM tickets WHERE org_id = ${orgId}
  `)
  const [ansRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id WHERE t.org_id = ${orgId}
  `)
  const [defRow] = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id
    WHERE a.auto_deflected = 1 AND t.org_id = ${orgId}
  `)

  return {
    totalTickets: Number((totRow as Record<string, unknown>).n ?? 0),
    answered: Number((ansRow as Record<string, unknown>).n ?? 0),
    deflected: Number((defRow as Record<string, unknown>).n ?? 0),
  }
}

export interface TrendPoint {
  day: string
  answered: number
  deflected: number
}

export async function getDeflectionTrend(days = 14, orgId = DEFAULT_ORG_ID): Promise<TrendPoint[]> {
  const rows = await getDb().execute(sql`
    SELECT LEFT(a.created_at, 10) AS day,
           COUNT(*)::int AS answered,
           SUM(a.auto_deflected)::int AS deflected
    FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id
    WHERE a.created_at >= (NOW() - (${days - 1} || ' days')::interval)::text
      AND t.org_id = ${orgId}
    GROUP BY LEFT(a.created_at, 10)
    ORDER BY LEFT(a.created_at, 10)
  `)
  return rows as unknown as TrendPoint[]
}

export interface CategoryCount {
  category: string
  count: number
}

export async function getCategoryBreakdown(orgId = DEFAULT_ORG_ID): Promise<CategoryCount[]> {
  const rows = await getDb().execute(sql`
    SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*)::int AS count
    FROM tickets
    WHERE org_id = ${orgId}
    GROUP BY category
    ORDER BY COUNT(*) DESC
  `)
  return rows as unknown as CategoryCount[]
}

export interface DocGap {
  id: number
  summary: string
  category: string | null
}

export async function getDocGaps(limit = 20, orgId = DEFAULT_ORG_ID): Promise<DocGap[]> {
  const rows = await getDb().execute(sql`
    SELECT t.id,
           COALESCE(t.ai_summary, LEFT(t.content, 120)) AS summary,
           t.category
    FROM tickets t
    LEFT JOIN kb_articles k ON k.source_ticket_id = t.id
    WHERE t.category IN ('documentation', 'how_to')
      AND t.status IN ('resolved', 'closed')
      AND k.id IS NULL
      AND t.org_id = ${orgId}
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `)
  return rows as unknown as DocGap[]
}

export interface SLAStats {
  responseMet: number
  responseBreached: number
  resolveMet: number
  resolveBreached: number
  avgFirstResponseMinutes: number | null
}

export async function getSLAStats(orgId = DEFAULT_ORG_ID): Promise<SLAStats> {
  const [row] = await getDb().execute(sql`
    SELECT
      SUM(CASE WHEN sla_response_met = 1 THEN 1 ELSE 0 END)::int AS "responseMet",
      SUM(CASE WHEN sla_response_met = 0 THEN 1 ELSE 0 END)::int AS "responseBreached",
      SUM(CASE WHEN sla_resolve_met = 1 THEN 1 ELSE 0 END)::int AS "resolveMet",
      SUM(CASE WHEN sla_resolve_met = 0 THEN 1 ELSE 0 END)::int AS "resolveBreached",
      AVG(
        CASE WHEN first_response_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (first_response_at::timestamp - created_at::timestamp)) / 60
        END
      ) AS "avgFirstResponseMinutes"
    FROM tickets
    WHERE org_id = ${orgId}
  `)
  const r = row as Record<string, number | null>
  return {
    responseMet: r.responseMet ?? 0,
    responseBreached: r.responseBreached ?? 0,
    resolveMet: r.resolveMet ?? 0,
    resolveBreached: r.resolveBreached ?? 0,
    avgFirstResponseMinutes: r.avgFirstResponseMinutes,
  }
}
