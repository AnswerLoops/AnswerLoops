import { openai, createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import type { EmbeddingModel, LanguageModel } from 'ai'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'
import { getOrgAIConfig } from '@/lib/db/queries/ai-config'

export async function chatModel(defaultId: string, orgId?: number): Promise<LanguageModel> {
  if (MOCK_EXTERNALS) {
    return (require('./mock') as typeof import('./mock')).mockLanguageModel(defaultId)
  }

  if (orgId !== undefined) {
    try {
      const cfg = await getOrgAIConfig(orgId)
      if (cfg?.chat_api_key || cfg?.chat_provider === 'openai-compatible') {
        return buildChatProvider(cfg.chat_provider, cfg.chat_api_key, cfg.chat_base_url)(cfg.chat_model || defaultId)
      }
    } catch {
      // fall through to platform key
    }
  }

  return openai(defaultId)
}

export async function embeddingModel(defaultId: string, orgId?: number): Promise<EmbeddingModel> {
  if (MOCK_EXTERNALS) {
    return (require('./mock') as typeof import('./mock')).mockEmbeddingModel(defaultId)
  }

  if (orgId !== undefined) {
    try {
      const cfg = await getOrgAIConfig(orgId)
      if (cfg) {
        const embKey = cfg.embedding_api_key ?? (cfg.chat_provider === 'openai' ? cfg.chat_api_key : null)
        if (embKey || cfg.embedding_base_url) {
          return createOpenAI({
            apiKey: embKey ?? undefined,
            baseURL: cfg.embedding_base_url ?? undefined,
          }).embedding(cfg.embedding_model || defaultId)
        }
      }
    } catch {
      // fall through to platform key
    }
  }

  return openai.embedding(defaultId)
}

function buildChatProvider(provider: string, apiKey: string | null, baseUrl: string | null) {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: apiKey ?? undefined })
    case 'google':
      return createGoogleGenerativeAI({ apiKey: apiKey ?? undefined })
    case 'groq':
      return createGroq({ apiKey: apiKey ?? undefined })
    case 'mistral':
      return createMistral({ apiKey: apiKey ?? undefined })
    case 'openai-compatible':
      return createOpenAI({ apiKey: apiKey ?? undefined, baseURL: baseUrl ?? undefined })
    default:
      return createOpenAI({ apiKey: apiKey ?? undefined })
  }
}
