import { listArticles } from '@/lib/db/queries/kb'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(listArticles())
}
