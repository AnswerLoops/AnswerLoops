import { eq, and, desc, sql, or, like } from 'drizzle-orm'
import { cosineSimilarity } from 'ai'
import { getDb } from '../drizzle'
import { kbArticles, DEFAULT_ORG_ID } from '../schema'
import type { KBArticle, KBSearchResult, PriorAnswer } from '@/types'

export const KB_MATCH_THRESHOLD = 0.45

function toArticle(row: typeof kbArticles.$inferSelect): KBArticle {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    source_ticket_id: row.sourceTicketId ?? null,
    source_id: row.sourceId ?? null,
    source_page: row.sourcePage ?? null,
    published: row.published as 0 | 1,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export async function createArticle(
  input: {
    question: string
    answer: string
    embedding: number[]
    model: string
    sourceTicketId?: number
  },
  orgId = DEFAULT_ORG_ID
): Promise<KBArticle> {
  const db = getDb()

  if (input.sourceTicketId != null) {
    const [existing] = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(and(eq(kbArticles.sourceTicketId, input.sourceTicketId), eq(kbArticles.orgId, orgId)))
      .limit(1)

    if (existing) {
      await db
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
      return (await getArticle(existing.id))!
    }
  }

  const [row] = await db
    .insert(kbArticles)
    .values({
      orgId,
      question: input.question,
      answer: input.answer,
      embedding: JSON.stringify(input.embedding),
      model: input.model,
      sourceTicketId: input.sourceTicketId ?? null,
    })
    .returning()

  return toArticle(row)
}

export async function getArticle(id: number): Promise<KBArticle | null> {
  const [row] = await getDb()
    .select()
    .from(kbArticles)
    .where(eq(kbArticles.id, id))
    .limit(1)
  return row ? toArticle(row) : null
}

export async function countArticles(orgId = DEFAULT_ORG_ID): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(kbArticles)
    .where(eq(kbArticles.orgId, orgId))
  return row?.n ?? 0
}

export async function getArticleBySourceTicket(ticketId: number, orgId = DEFAULT_ORG_ID): Promise<KBArticle | null> {
  const [row] = await getDb()
    .select()
    .from(kbArticles)
    .where(and(eq(kbArticles.sourceTicketId, ticketId), eq(kbArticles.orgId, orgId)))
    .limit(1)
  return row ? toArticle(row) : null
}

export async function listArticles(publishedOnly = true, orgId = DEFAULT_ORG_ID): Promise<KBArticle[]> {
  const conditions = publishedOnly
    ? and(eq(kbArticles.published, 1), eq(kbArticles.orgId, orgId))
    : eq(kbArticles.orgId, orgId)

  const rows = await getDb()
    .select()
    .from(kbArticles)
    .where(conditions)
    .orderBy(desc(kbArticles.updatedAt))
  return rows.map(toArticle)
}

export async function searchArticles(vector: number[], limit = 10, orgId = DEFAULT_ORG_ID): Promise<KBSearchResult[]> {
  const rows = await getDb()
    .select()
    .from(kbArticles)
    .where(and(eq(kbArticles.published, 1), eq(kbArticles.orgId, orgId)))

  return rows
    .map((row) => ({
      ...toArticle(row),
      score: cosineSimilarity(vector, JSON.parse(row.embedding) as number[]),
    }))
    .filter((r) => r.score >= KB_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function textSearchArticles(query: string, limit = 10, orgId = DEFAULT_ORG_ID): Promise<KBArticle[]> {
  const pattern = `%${query}%`
  const rows = await getDb()
    .select()
    .from(kbArticles)
    .where(
      and(
        eq(kbArticles.published, 1),
        eq(kbArticles.orgId, orgId),
        or(like(kbArticles.question, pattern), like(kbArticles.answer, pattern))
      )
    )
    .orderBy(desc(kbArticles.updatedAt))
    .limit(limit)
  return rows.map(toArticle)
}

export async function createArticleFromSource(
  input: {
    question: string
    answer: string
    embedding: number[]
    model: string
    sourceId: number
    sourcePage?: number
  },
  orgId = DEFAULT_ORG_ID
): Promise<KBArticle> {
  const [row] = await getDb()
    .insert(kbArticles)
    .values({
      orgId,
      question: input.question,
      answer: input.answer,
      embedding: JSON.stringify(input.embedding),
      model: input.model,
      sourceId: input.sourceId,
      sourcePage: input.sourcePage ?? null,
    })
    .returning()
  return toArticle(row)
}

export async function deleteArticle(id: number, orgId = DEFAULT_ORG_ID): Promise<void> {
  await getDb()
    .delete(kbArticles)
    .where(and(eq(kbArticles.id, id), eq(kbArticles.orgId, orgId)))
}

export async function getKBContext(vector: number[], k = 3, orgId = DEFAULT_ORG_ID): Promise<PriorAnswer[]> {
  const results = await searchArticles(vector, k, orgId)
  return results.map((a) => ({ summary: a.question, answer: a.answer }))
}
