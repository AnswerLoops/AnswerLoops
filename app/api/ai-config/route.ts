import { requireOrgAccess } from '@/lib/auth/org'
import { getOrgAIConfig } from '@/lib/db/queries/ai-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireOrgAccess()
  if (!access.ok) return new Response('Unauthorized', { status: 401 })

  const config = await getOrgAIConfig(access.orgId)
  if (!config) return Response.json(null)

  // Never expose raw API keys to the client — return masked presence only
  return Response.json({
    chat_provider: config.chat_provider,
    chat_model: config.chat_model,
    chat_api_key_set: !!config.chat_api_key,
    chat_base_url: config.chat_base_url,
    embedding_provider: config.embedding_provider,
    embedding_model: config.embedding_model,
    embedding_api_key_set: !!config.embedding_api_key,
    embedding_base_url: config.embedding_base_url,
  })
}
