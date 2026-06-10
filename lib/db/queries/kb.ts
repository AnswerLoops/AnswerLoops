import { cosineSimilarity } from 'ai'
import { getDb } from '../index'
import type { KBArticle, KBSearchResult, PriorAnswer } from '@/types'

// Below this similarity, a KB article isn't relevant enough to surface or to
// ground the agent with.
export const KB_MATCH_THRESHOLD = 0.45

const ARTICLE_COLS = 'id, question, answer, source_ticket_id, published, created_at, updated_at'

/** Promote a resolved answer into the knowledge base (or refresh an existing one). */
export function createArticle(input: {
  question: string
  answer: string
  embedding: number[]
  model: string
  sourceTicketId?: number
}): KBArticle {
  const db = getDb()
  // One article per source ticket — re-promoting updates in place.
  if (input.sourceTicketId != null) {
    const existing = db
      .prepare('SELECT id FROM kb_articles WHERE source_ticket_id = ?')
      .get(input.sourceTicketId) as { id: number } | undefined
    if (existing) {
      db.prepare(`
        UPDATE kb_articles
        SET question = ?, answer = ?, embedding = ?, model = ?, published = 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(input.question, input.answer, JSON.stringify(input.embedding), input.model, existing.id)
      return getArticle(existing.id)!
    }
  }

  const result = db.prepare(`
    INSERT INTO kb_articles (question, answer, embedding, model, source_ticket_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    input.question,
    input.answer,
    JSON.stringify(input.embedding),
    input.model,
    input.sourceTicketId ?? null
  )
  return getArticle(Number(result.lastInsertRowid))!
}

export function getArticle(id: number): KBArticle | null {
  return (getDb().prepare(`SELECT ${ARTICLE_COLS} FROM kb_articles WHERE id = ?`).get(id) as KBArticle) ?? null
}

/** Whether a ticket has already been promoted. */
export function getArticleBySourceTicket(ticketId: number): KBArticle | null {
  return (getDb()
    .prepare(`SELECT ${ARTICLE_COLS} FROM kb_articles WHERE source_ticket_id = ?`)
    .get(ticketId) as KBArticle) ?? null
}

export function listArticles(publishedOnly = true): KBArticle[] {
  const where = publishedOnly ? 'WHERE published = 1' : ''
  return getDb()
    .prepare(`SELECT ${ARTICLE_COLS} FROM kb_articles ${where} ORDER BY updated_at DESC`)
    .all() as KBArticle[]
}

interface EmbeddedRow extends KBArticle {
  embedding: string
}

/** Published articles ranked by cosine similarity to a query vector. */
export function searchArticles(vector: number[], limit = 10): KBSearchResult[] {
  const rows = getDb()
    .prepare(`SELECT ${ARTICLE_COLS}, embedding FROM kb_articles WHERE published = 1`)
    .all() as EmbeddedRow[]

  return rows
    .map(({ embedding, ...article }) => ({
      ...article,
      score: cosineSimilarity(vector, JSON.parse(embedding) as number[]),
    }))
    .filter((r) => r.score >= KB_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Top KB articles for a question vector, shaped for grounding the agent. Used
 * before raw prior tickets — promoted knowledge is the canonical source.
 */
export function getKBContext(vector: number[], k = 3): PriorAnswer[] {
  return searchArticles(vector, k).map((a) => ({ summary: a.question, answer: a.answer }))
}
