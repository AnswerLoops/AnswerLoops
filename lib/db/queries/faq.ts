import { getDb } from '../index'
import type { FAQSnapshot } from '@/types'

export function getLatestFAQ(): FAQSnapshot | null {
  return (getDb().prepare('SELECT * FROM faq_snapshots ORDER BY generated_at DESC LIMIT 1').get() as FAQSnapshot) ?? null
}

export function getFAQHistory(limit = 10): FAQSnapshot[] {
  return getDb().prepare('SELECT * FROM faq_snapshots ORDER BY generated_at DESC LIMIT ?').all(limit) as FAQSnapshot[]
}

export function insertFAQSnapshot(weekStart: string, weekEnd: string, content: string, ticketCount: number): FAQSnapshot {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO faq_snapshots (week_start, week_end, content, ticket_count)
    VALUES (?, ?, ?, ?)
  `).run(weekStart, weekEnd, content, ticketCount)
  return db.prepare('SELECT * FROM faq_snapshots WHERE id = ?').get(result.lastInsertRowid) as FAQSnapshot
}

export function getResolvedTicketsThisWeek() {
  const db = getDb()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return db.prepare(`
    SELECT id, content, category, ai_summary, resolution_notes
    FROM tickets
    WHERE status IN ('resolved', 'closed')
      AND resolved_at > ?
  `).all(weekAgo) as Array<{
    id: number
    content: string
    category: string | null
    ai_summary: string | null
    resolution_notes: string | null
  }>
}
