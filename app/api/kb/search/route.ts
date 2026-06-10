import { embedText } from '@/lib/ai/embed'
import { searchArticles } from '@/lib/db/queries/kb'

export const dynamic = 'force-dynamic'

// Semantic search over published KB articles. Embeds the query and ranks by
// cosine similarity, reusing the same embedding infra as ticket dedup.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q) return Response.json([])

  try {
    const vector = await embedText(q)
    return Response.json(searchArticles(vector))
  } catch (err) {
    console.error('[kb/search] failed:', err)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
