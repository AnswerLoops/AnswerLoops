import { eq } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { aiConfigs } from '../schema'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'

export interface OrgAIConfig {
  id: number
  org_id: number
  chat_provider: string
  chat_model: string
  chat_api_key: string | null
  chat_base_url: string | null
  embedding_provider: string
  embedding_model: string
  embedding_api_key: string | null
  embedding_base_url: string | null
}

function toConfig(row: typeof aiConfigs.$inferSelect): OrgAIConfig {
  return {
    id: row.id,
    org_id: row.orgId,
    chat_provider: row.chatProvider,
    chat_model: row.chatModel,
    chat_api_key: row.chatApiKey ? decryptToken(row.chatApiKey) : null,
    chat_base_url: row.chatBaseUrl,
    embedding_provider: row.embeddingProvider,
    embedding_model: row.embeddingModel,
    embedding_api_key: row.embeddingApiKey ? decryptToken(row.embeddingApiKey) : null,
    embedding_base_url: row.embeddingBaseUrl,
  }
}

export async function getOrgAIConfig(orgId: number): Promise<OrgAIConfig | null> {
  try {
    const [row] = await getDb()
      .select()
      .from(aiConfigs)
      .where(eq(aiConfigs.orgId, orgId))
      .limit(1)
    return row ? toConfig(row) : null
  } catch {
    return null
  }
}

export async function saveOrgAIConfig(
  orgId: number,
  config: {
    chat_provider: string
    chat_model: string
    chat_api_key?: string | null
    chat_base_url?: string | null
    embedding_provider: string
    embedding_model: string
    embedding_api_key?: string | null
    embedding_base_url?: string | null
  }
): Promise<void> {
  const now = new Date().toISOString()
  const encChatKey = config.chat_api_key ? encryptToken(config.chat_api_key) : null
  const encEmbedKey = config.embedding_api_key ? encryptToken(config.embedding_api_key) : null

  await getDb()
    .insert(aiConfigs)
    .values({
      orgId,
      chatProvider: config.chat_provider,
      chatModel: config.chat_model,
      chatApiKey: encChatKey,
      chatBaseUrl: config.chat_base_url ?? null,
      embeddingProvider: config.embedding_provider,
      embeddingModel: config.embedding_model,
      embeddingApiKey: encEmbedKey,
      embeddingBaseUrl: config.embedding_base_url ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiConfigs.orgId,
      set: {
        chatProvider: config.chat_provider,
        chatModel: config.chat_model,
        // null means "keep existing key" — only overwrite when a new value is provided
        ...(encChatKey !== null ? { chatApiKey: encChatKey } : {}),
        chatBaseUrl: config.chat_base_url ?? null,
        embeddingProvider: config.embedding_provider,
        embeddingModel: config.embedding_model,
        ...(encEmbedKey !== null ? { embeddingApiKey: encEmbedKey } : {}),
        embeddingBaseUrl: config.embedding_base_url ?? null,
        updatedAt: now,
      },
    })
}

export async function deleteOrgAIConfig(orgId: number): Promise<void> {
  await getDb().delete(aiConfigs).where(eq(aiConfigs.orgId, orgId))
}
