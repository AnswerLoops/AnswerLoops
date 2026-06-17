'use server'

import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { ensureWidgetToken } from '@/lib/db/queries/widgets'

export async function getWidgetTokenAction(): Promise<{ token: string } | { error: string }> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const token = ensureWidgetToken(orgId)
  return { token }
}
