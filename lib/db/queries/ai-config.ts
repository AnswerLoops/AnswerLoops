import { getDb } from '@/lib/db'

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

export function getOrgAIConfig(orgId: number): OrgAIConfig | null {
  try {
    const db = getDb()
    return db.prepare('SELECT * FROM ai_configs WHERE org_id = ?').get(orgId) as OrgAIConfig | null
  } catch {
    return null
  }
}

export function saveOrgAIConfig(orgId: number, config: {
  chat_provider: string
  chat_model: string
  chat_api_key?: string | null
  chat_base_url?: string | null
  embedding_provider: string
  embedding_model: string
  embedding_api_key?: string | null
  embedding_base_url?: string | null
}): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO ai_configs (org_id, chat_provider, chat_model, chat_api_key, chat_base_url,
      embedding_provider, embedding_model, embedding_api_key, embedding_base_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(org_id) DO UPDATE SET
      chat_provider      = excluded.chat_provider,
      chat_model         = excluded.chat_model,
      chat_api_key       = CASE WHEN excluded.chat_api_key IS NULL THEN chat_api_key ELSE excluded.chat_api_key END,
      chat_base_url      = excluded.chat_base_url,
      embedding_provider = excluded.embedding_provider,
      embedding_model    = excluded.embedding_model,
      embedding_api_key  = CASE WHEN excluded.embedding_api_key IS NULL THEN embedding_api_key ELSE excluded.embedding_api_key END,
      embedding_base_url = excluded.embedding_base_url,
      updated_at         = datetime('now')
  `).run(
    orgId,
    config.chat_provider,
    config.chat_model,
    config.chat_api_key ?? null,
    config.chat_base_url ?? null,
    config.embedding_provider,
    config.embedding_model,
    config.embedding_api_key ?? null,
    config.embedding_base_url ?? null,
  )
}

export function deleteOrgAIConfig(orgId: number): void {
  getDb().prepare('DELETE FROM ai_configs WHERE org_id = ?').run(orgId)
}
