import { getDb } from '../index'

export interface DeflectionStats {
  totalTickets: number
  answered: number
  deflected: number
}

/** Top-line counts: tickets, AI-answered (assessed), and auto-deflected. */
export function getDeflectionStats(): DeflectionStats {
  const db = getDb()
  const totalTickets = (db.prepare('SELECT COUNT(*) AS n FROM tickets').get() as { n: number }).n
  const answered = (db.prepare('SELECT COUNT(*) AS n FROM ai_assessments').get() as { n: number }).n
  const deflected = (db.prepare('SELECT COUNT(*) AS n FROM ai_assessments WHERE auto_deflected = 1').get() as {
    n: number
  }).n
  return { totalTickets, answered, deflected }
}

export interface TrendPoint {
  day: string
  answered: number
  deflected: number
}

/** Daily answered vs auto-deflected counts over the last `days` days. */
export function getDeflectionTrend(days = 14): TrendPoint[] {
  return getDb()
    .prepare(`
      SELECT date(created_at) AS day,
             COUNT(*) AS answered,
             SUM(auto_deflected) AS deflected
      FROM ai_assessments
      WHERE created_at >= date('now', ?)
      GROUP BY day
      ORDER BY day
    `)
    .all(`-${days - 1} days`) as TrendPoint[]
}

export interface CategoryCount {
  category: string
  count: number
}

/** Ticket volume by category — the lightweight "trending topics" view. */
export function getCategoryBreakdown(): CategoryCount[] {
  return getDb()
    .prepare(`
      SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*) AS count
      FROM tickets
      GROUP BY category
      ORDER BY count DESC
    `)
    .all() as CategoryCount[]
}

export interface DocGap {
  id: number
  summary: string
  category: string | null
}

/**
 * Resolved how-to / documentation tickets that were never promoted to the KB —
 * the gaps where documentation (or a KB article) is missing.
 */
export function getDocGaps(limit = 20): DocGap[] {
  return getDb()
    .prepare(`
      SELECT t.id,
             COALESCE(t.ai_summary, substr(t.content, 1, 120)) AS summary,
             t.category
      FROM tickets t
      LEFT JOIN kb_articles k ON k.source_ticket_id = t.id
      WHERE t.category IN ('documentation', 'how_to')
        AND t.status IN ('resolved', 'closed')
        AND k.id IS NULL
      ORDER BY t.created_at DESC
      LIMIT ?
    `)
    .all(limit) as DocGap[]
}

export interface SLAStats {
  responseMet: number
  responseBreached: number
  resolveMet: number
  resolveBreached: number
  avgFirstResponseMinutes: number | null
}

/** SLA attainment counts and average time-to-first-response (minutes). */
export function getSLAStats(): SLAStats {
  const db = getDb()
  const row = db
    .prepare(`
      SELECT
        SUM(CASE WHEN sla_response_met = 1 THEN 1 ELSE 0 END) AS responseMet,
        SUM(CASE WHEN sla_response_met = 0 THEN 1 ELSE 0 END) AS responseBreached,
        SUM(CASE WHEN sla_resolve_met = 1 THEN 1 ELSE 0 END) AS resolveMet,
        SUM(CASE WHEN sla_resolve_met = 0 THEN 1 ELSE 0 END) AS resolveBreached,
        AVG(CASE WHEN first_response_at IS NOT NULL
                 THEN (julianday(first_response_at) - julianday(created_at)) * 1440 END) AS avgFirstResponseMinutes
      FROM tickets
    `)
    .get() as Record<string, number | null>

  return {
    responseMet: row.responseMet ?? 0,
    responseBreached: row.responseBreached ?? 0,
    resolveMet: row.resolveMet ?? 0,
    resolveBreached: row.resolveBreached ?? 0,
    avgFirstResponseMinutes: row.avgFirstResponseMinutes,
  }
}
