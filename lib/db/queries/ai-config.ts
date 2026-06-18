import { eq } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { aiConfigs } from '../schema'

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
    chat_api_key: row.chatApiKey,
    chat_base_url: row.chatBaseUrl,
    embedding_provider: row.embeddingProvider,
    embedding_model: row.embeddingModel,
    embedding_api_key: row.embeddingApiKey,
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
  await getDb()
    .insert(aiConfigs)
    .values({
      orgId,
      chatProvider: config.chat_provider,
      chatModel: config.chat_model,
      chatApiKey: config.chat_api_key ?? null,
      chatBaseUrl: config.chat_base_url ?? null,
      embeddingProvider: config.embedding_provider,
      embeddingModel: config.embedding_model,
      embeddingApiKey: config.embedding_api_key ?? null,
      embeddingBaseUrl: config.embedding_base_url ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiConfigs.orgId,
      set: {
        chatProvider: config.chat_provider,
        chatModel: config.chat_model,
        // NULL means "keep existing key" — only overwrite when a new value is provided
        ...(config.chat_api_key !== null && config.chat_api_key !== undefined
          ? { chatApiKey: config.chat_api_key }
          : {}),
        chatBaseUrl: config.chat_base_url ?? null,
        embeddingProvider: config.embedding_provider,
        embeddingModel: config.embedding_model,
        ...(config.embedding_api_key !== null && config.embedding_api_key !== undefined
          ? { embeddingApiKey: config.embedding_api_key }
          : {}),
        embeddingBaseUrl: config.embedding_base_url ?? null,
        updatedAt: now,
      },
    })
}

export async function deleteOrgAIConfig(orgId: number): Promise<void> {
  await getDb().delete(aiConfigs).where(eq(aiConfigs.orgId, orgId))
}
