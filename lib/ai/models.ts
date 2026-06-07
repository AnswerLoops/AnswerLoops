import { openai } from '@ai-sdk/openai'
import type { EmbeddingModel, LanguageModel } from 'ai'
// EmbeddingModel is non-generic in this SDK version.
import { MOCK_EXTERNALS } from '@/lib/mock-mode'

/**
 * Central factory for the models the AI layer uses. In normal operation these
 * are real OpenAI models; under MOCK_EXTERNALS they are deterministic fakes
 * (see lib/ai/mock.ts). Routing everything through here means the lib/ai
 * functions never reference a provider directly, so tests can swap the whole
 * AI layer with one env flag.
 */
export function chatModel(id: string): LanguageModel {
  if (MOCK_EXTERNALS) {
    // Lazy require so ai/test is never pulled into a production bundle.
    return (require('./mock') as typeof import('./mock')).mockLanguageModel(id)
  }
  return openai(id)
}

export function embeddingModel(id: string): EmbeddingModel {
  if (MOCK_EXTERNALS) {
    return (require('./mock') as typeof import('./mock')).mockEmbeddingModel(id)
  }
  return openai.embedding(id)
}
