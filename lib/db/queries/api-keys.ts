import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { apiKeys } from '../schema'
import { generateApiKey, hashApiKey } from '@/lib/mcp/keys'

export interface ApiKey {
  id: number
  org_id: number
  key_prefix: string
  name: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

function toApiKey(row: typeof apiKeys.$inferSelect): ApiKey {
  return {
    id: row.id,
    org_id: row.orgId,
    key_prefix: row.keyPrefix,
    name: row.name,
    created_at: row.createdAt,
    last_used_at: row.lastUsedAt,
    expires_at: row.expiresAt,
    revoked_at: row.revokedAt,
  }
}

/** Creates a key and returns the plaintext once — never retrievable again after this call. */
export async function createApiKey(orgId: number, name: string): Promise<{ plaintextKey: string; record: ApiKey }> {
  const { key, hash, prefix } = generateApiKey()
  const [row] = await getDb()
    .insert(apiKeys)
    .values({ orgId, keyHash: hash, keyPrefix: prefix, name })
    .returning()
  return { plaintextKey: key, record: toApiKey(row) }
}

/** Active + revoked keys, newest first — UI shows revoked ones greyed out rather than hiding them. */
export async function listApiKeys(orgId: number): Promise<ApiKey[]> {
  const rows = await getDb()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(apiKeys.createdAt)
  return rows.map(toApiKey).reverse()
}

/** Org-scoped so one org can never revoke another org's key by guessing an id (IDOR guard). */
export async function revokeApiKey(orgId: number, keyId: number): Promise<void> {
  await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)))
}

/**
 * Resolves a presented Bearer key to its org, enforcing revocation/expiry,
 * and records last-used. Returns null for any invalid/inactive key — callers
 * must not distinguish "wrong key" from "revoked key" in the response (avoids
 * leaking key-validity as an oracle).
 */
export async function resolveApiKey(plaintextKey: string): Promise<{ orgId: number; keyId: number } | null> {
  const hash = hashApiKey(plaintextKey)
  const [row] = await getDb()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1)
  if (!row) return null
  if (row.expiresAt && row.expiresAt < new Date().toISOString()) return null

  await getDb().update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, row.id))
  return { orgId: row.orgId, keyId: row.id }
}
