'use server'

import { z } from 'zod'
import { refresh } from 'next/cache'
import { auth } from '@/auth'
import { createApiKey, revokeApiKey } from '@/lib/db/queries/api-keys'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const CreateKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
})

export async function createApiKeyAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; plaintextKey?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = CreateKeySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { plaintextKey } = await createApiKey(orgId, parsed.data.name)
  refresh()
  // Plaintext is returned once — the UI must show it now, it can never be fetched again.
  return { plaintextKey }
}

const RevokeKeySchema = z.object({
  keyId: z.coerce.number(),
})

export async function revokeApiKeyAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = RevokeKeySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid input' }

  await revokeApiKey(orgId, parsed.data.keyId)
  refresh()
  return null
}
