import { eq, and, gte, sql } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { apiGenerations } from '../schema'

/** Records one generate_answer MCP call. highConfidence mirrors auto_deflected on tickets. */
export async function recordApiGeneration(orgId: number, highConfidence: boolean): Promise<void> {
  await getDb()
    .insert(apiGenerations)
    .values({ orgId, highConfidence: highConfidence ? 1 : 0 })
}

/** Count of high-confidence generate_answer calls for the org since periodStart. */
export async function getMonthlyApiGenerations(orgId: number, periodStart: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(apiGenerations)
    .where(
      and(
        eq(apiGenerations.orgId, orgId),
        eq(apiGenerations.highConfidence, 1),
        gte(apiGenerations.createdAt, periodStart.toISOString())
      )
    )
  return Number(row?.n ?? 0)
}
