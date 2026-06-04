import { getRepos } from '@/lib/db/queries/github'

export async function GET() {
  return Response.json(getRepos())
}
