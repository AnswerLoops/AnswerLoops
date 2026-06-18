import { auth } from '@/auth'
import { embedText } from '@/lib/ai/embed'
import { searchArticles } from '@/lib/db/queries/kb'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await auth()
  const orgId = session?.orgId ?? DEFAULT_ORG_ID

  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q) return Response.json([])

  try {
    const vector = await embedText(q)
    return Response.json(searchArticles(vector, 10, orgId))
  } catch (err) {
    console.error('[kb/search] failed:', err)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
