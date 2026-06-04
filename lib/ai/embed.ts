import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

export const EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * Embed a piece of text into a vector. Caller is responsible for combining the
 * fields worth embedding (e.g. summary + content) into `text`.
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  })
  return embedding
}
