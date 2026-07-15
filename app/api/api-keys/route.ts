import { auth } from '@/auth'
import { listApiKeys } from '@/lib/db/queries/api-keys'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const keys = await listApiKeys(orgId)
  return Response.json(keys)
}
