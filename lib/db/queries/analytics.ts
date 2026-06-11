import { getDb } from '../index'
import { DEFAULT_ORG_ID } from '../schema'

export interface DeflectionStats {
  totalTickets: number
  answered: number
  deflected: number
}

export function getDeflectionStats(orgId = DEFAULT_ORG_ID): DeflectionStats {
  const rawDb = getDb()
  const totalTickets = (rawDb.prepare('SELECT COUNT(*) AS n FROM tickets WHERE org_id = ?').get(orgId) as { n: number }).n
  const answered = (rawDb.prepare(`
    SELECT COUNT(*) AS n FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id WHERE t.org_id = ?
  `).get(orgId) as { n: number }).n
  const deflected = (rawDb.prepare(`
    SELECT COUNT(*) AS n FROM ai_assessments a
    JOIN tickets t ON t.id = a.ticket_id
    WHERE a.auto_deflected = 1 AND t.org_id = ?
  `).get(orgId) as { n: number }).n
  return { totalTickets, answered, deflected }
}

export interface TrendPoint {
  day: string
  answered: number
  deflected: number
}

export function getDeflectionTrend(days = 14, orgId = DEFAULT_ORG_ID): TrendPoint[] {
  return getDb()
    .prepare(
      `SELECT date(a.created_at) AS day,
              COUNT(*) AS answered,
              SUM(a.auto_deflected) AS deflected
       FROM ai_assessments a
       JOIN tickets t ON t.id = a.ticket_id
       WHERE a.created_at >= date('now', ?)
         AND t.org_id = ?
       GROUP BY day
       ORDER BY day`
    )
    .all(`-${days - 1} days`, orgId) as TrendPoint[]
}

export interface CategoryCount {
  category: string
  count: number
}

export function getCategoryBreakdown(orgId = DEFAULT_ORG_ID): CategoryCount[] {
  return getDb()
    .prepare(
      `SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*) AS count
       FROM tickets
       WHERE org_id = ?
       GROUP BY category
       ORDER BY count DESC`
    )
    .all(orgId) as CategoryCount[]
}

export interface DocGap {
  id: number
  summary: string
  category: string | null
}

export function getDocGaps(limit = 20, orgId = DEFAULT_ORG_ID): DocGap[] {
  return getDb()
    .prepare(
      `SELECT t.id,
              COALESCE(t.ai_summary, substr(t.content, 1, 120)) AS summary,
              t.category
       FROM tickets t
       LEFT JOIN kb_articles k ON k.source_ticket_id = t.id
       WHERE t.category IN ('documentation', 'how_to')
         AND t.status IN ('resolved', 'closed')
         AND k.id IS NULL
         AND t.org_id = ?
       ORDER BY t.created_at DESC
       LIMIT ?`
    )
    .all(orgId, limit) as DocGap[]
}

export interface SLAStats {
  responseMet: number
  responseBreached: number
  resolveMet: number
  resolveBreached: number
  avgFirstResponseMinutes: number | null
}

export function getSLAStats(orgId = DEFAULT_ORG_ID): SLAStats {
  const row = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN sla_response_met = 1 THEN 1 ELSE 0 END) AS responseMet,
         SUM(CASE WHEN sla_response_met = 0 THEN 1 ELSE 0 END) AS responseBreached,
         SUM(CASE WHEN sla_resolve_met = 1 THEN 1 ELSE 0 END) AS resolveMet,
         SUM(CASE WHEN sla_resolve_met = 0 THEN 1 ELSE 0 END) AS resolveBreached,
         AVG(CASE WHEN first_response_at IS NOT NULL
                  THEN (julianday(first_response_at) - julianday(created_at)) * 1440 END) AS avgFirstResponseMinutes
       FROM tickets
       WHERE org_id = ?`
    )
    .get(orgId) as Record<string, number | null>

  return {
    responseMet: row.responseMet ?? 0,
    responseBreached: row.responseBreached ?? 0,
    resolveMet: row.resolveMet ?? 0,
    resolveBreached: row.resolveBreached ?? 0,
    avgFirstResponseMinutes: row.avgFirstResponseMinutes,
  }
}
