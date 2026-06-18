import { eq, and } from 'drizzle-orm'
import { cosineSimilarity } from 'ai'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { kbArticles, DEFAULT_ORG_ID } from '../schema'
import type { KBArticle, KBSearchResult, PriorAnswer } from '@/types'

export const KB_MATCH_THRESHOLD = 0.45

function dz() { return getDrizzle() }
function raw() { return getDb() }

const ARTICLE_COLS = 'id, question, answer, source_ticket_id, published, created_at, updated_at'

export function createArticle(input: {
  question: string
  answer: string
  embedding: number[]
  model: string
  sourceTicketId?: number
}, orgId = DEFAULT_ORG_ID): KBArticle {
  if (input.sourceTicketId != null) {
    const existing = raw()
      .prepare('SELECT id FROM kb_articles WHERE source_ticket_id = ? AND org_id = ?')
      .get(input.sourceTicketId, orgId) as { id: number } | undefined
    if (existing) {
      dz()
        .update(kbArticles)
        .set({
          question: input.question,
          answer: input.answer,
          embedding: JSON.stringify(input.embedding),
          model: input.model,
          published: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(kbArticles.id, existing.id))
        .run()
      return getArticle(existing.id)!
    }
  }

  const result = dz()
    .insert(kbArticles)
    .values({
      orgId,
      question: input.question,
      answer: input.answer,
      embedding: JSON.stringify(input.embedding),
      model: input.model,
      sourceTicketId: input.sourceTicketId ?? null,
    })
    .run()

  return getArticle(Number(result.lastInsertRowid))!
}

export function getArticle(id: number): KBArticle | null {
  return (raw().prepare(`SELECT ${ARTICLE_COLS} FROM kb_articles WHERE id = ?`).get(id) as KBArticle) ?? null
}

export function countArticles(orgId = DEFAULT_ORG_ID): number {
  const row = raw()
    .prepare('SELECT COUNT(*) AS n FROM kb_articles WHERE org_id = ?')
    .get(orgId) as { n: number }
  return row.n
}

export function getArticleBySourceTicket(ticketId: number, orgId = DEFAULT_ORG_ID): KBArticle | null {
  return (
    raw()
      .prepare(`SELECT ${ARTICLE_COLS} FROM kb_articles WHERE source_ticket_id = ? AND org_id = ?`)
      .get(ticketId, orgId) as KBArticle
  ) ?? null
}

export function listArticles(publishedOnly = true, orgId = DEFAULT_ORG_ID): KBArticle[] {
  const where = publishedOnly
    ? 'WHERE published = 1 AND org_id = ?'
    : 'WHERE org_id = ?'
  return raw()
    .prepare(`SELECT ${ARTICLE_COLS} FROM kb_articles ${where} ORDER BY updated_at DESC`)
    .all(orgId) as KBArticle[]
}

interface EmbeddedRow extends KBArticle {
  embedding: string
}

export function searchArticles(vector: number[], limit = 10, orgId = DEFAULT_ORG_ID): KBSearchResult[] {
  const rows = raw()
    .prepare(`SELECT ${ARTICLE_COLS}, embedding FROM kb_articles WHERE published = 1 AND org_id = ?`)
    .all(orgId) as EmbeddedRow[]

  return rows
    .map(({ embedding, ...article }) => ({
      ...article,
      score: cosineSimilarity(vector, JSON.parse(embedding) as number[]),
    }))
    .filter((r) => r.score >= KB_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function getKBContext(vector: number[], k = 3, orgId = DEFAULT_ORG_ID): PriorAnswer[] {
  return searchArticles(vector, k, orgId).map((a) => ({ summary: a.question, answer: a.answer }))
}
