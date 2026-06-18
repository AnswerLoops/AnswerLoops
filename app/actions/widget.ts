'use server'

import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { ensureWidgetToken, rotateWidgetToken } from '@/lib/db/queries/widgets'

export interface WidgetTokenResult {
  token?: string
  expiresAt?: string
  error?: string
}

export async function getWidgetTokenAction(): Promise<WidgetTokenResult> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const info = ensureWidgetToken(orgId)
  return { token: info.token, expiresAt: info.expiresAt }
}

export async function regenerateWidgetTokenAction(): Promise<WidgetTokenResult> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const info = rotateWidgetToken(orgId)
  return { token: info.token, expiresAt: info.expiresAt }
}
