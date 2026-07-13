import { eq, and, desc, sql } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { kbSources, kbArticles } from '../schema'
import type { KBSource } from '@/types'

function toSource(row: typeof kbSources.$inferSelect): KBSource {
  return {
    id: row.id,
    org_id: row.orgId,
    filename: row.filename,
    file_type: row.fileType,
    size_bytes: row.sizeBytes,
    chunk_count: row.chunkCount,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export async function createKBSource(input: {
  orgId: number
  filename: string
  fileType: string
  sizeBytes: number
}): Promise<KBSource> {
  const [row] = await getDb()
    .insert(kbSources)
    .values({
      orgId: input.orgId,
      filename: input.filename,
      fileType: input.fileType,
      sizeBytes: input.sizeBytes,
      chunkCount: 0,
    })
    .returning()
  return toSource(row)
}

export async function updateKBSourceChunkCount(id: number, chunkCount: number): Promise<void> {
  await getDb()
    .update(kbSources)
    .set({ chunkCount, updatedAt: new Date().toISOString() })
    .where(eq(kbSources.id, id))
}

export async function getKBSourceByFilename(orgId: number, filename: string): Promise<KBSource | null> {
  const [row] = await getDb()
    .select()
    .from(kbSources)
    .where(and(eq(kbSources.orgId, orgId), eq(kbSources.filename, filename)))
    .limit(1)
  return row ? toSource(row) : null
}

export async function listKBSources(orgId: number): Promise<KBSource[]> {
  const rows = await getDb()
    .select()
    .from(kbSources)
    .where(eq(kbSources.orgId, orgId))
    .orderBy(desc(kbSources.createdAt))
  return rows.map(toSource)
}

export async function deleteKBSource(id: number, orgId: number): Promise<void> {
  // Articles with source_id FK ON DELETE CASCADE are removed automatically
  await getDb()
    .delete(kbSources)
    .where(and(eq(kbSources.id, id), eq(kbSources.orgId, orgId)))
}
