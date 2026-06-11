import { eq } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { faqSnapshots, DEFAULT_ORG_ID } from '../schema'
import type { FAQSnapshot } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function getLatestFAQ(orgId = DEFAULT_ORG_ID): FAQSnapshot | null {
  return (
    raw()
      .prepare('SELECT * FROM faq_snapshots WHERE org_id = ? ORDER BY generated_at DESC LIMIT 1')
      .get(orgId) as FAQSnapshot
  ) ?? null
}

export function getFAQHistory(limit = 10, orgId = DEFAULT_ORG_ID): FAQSnapshot[] {
  return raw()
    .prepare('SELECT * FROM faq_snapshots WHERE org_id = ? ORDER BY generated_at DESC LIMIT ?')
    .all(orgId, limit) as FAQSnapshot[]
}

export function insertFAQSnapshot(weekStart: string, weekEnd: string, content: string, ticketCount: number, orgId = DEFAULT_ORG_ID): FAQSnapshot {
  const result = dz()
    .insert(faqSnapshots)
    .values({ orgId, weekStart, weekEnd, content, ticketCount })
    .run()

  return raw()
    .prepare('SELECT * FROM faq_snapshots WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as FAQSnapshot
}

export function getResolvedTicketsThisWeek(orgId = DEFAULT_ORG_ID) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return raw()
    .prepare(
      `SELECT id, content, category, ai_summary, resolution_notes
       FROM tickets
       WHERE status IN ('resolved', 'closed')
         AND resolved_at > ?
         AND org_id = ?`
    )
    .all(weekAgo, orgId) as Array<{
    id: number
    content: string
    category: string | null
    ai_summary: string | null
    resolution_notes: string | null
  }>
}
