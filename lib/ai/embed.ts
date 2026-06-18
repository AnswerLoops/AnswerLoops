import { embed } from 'ai'
import { embeddingModel } from '@/lib/ai/models'

export const EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * Embed a piece of text into a vector. Caller is responsible for combining the
 * fields worth embedding (e.g. summary + content) into `text`.
 */
export async function embedText(text: string, orgId?: number): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(EMBEDDING_MODEL, orgId),
    value: text,
  })
  return embedding
}
