'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { updateOrgName, setOrgOnboarded } from '@/lib/db/queries/orgs'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const NameSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(80),
})

export async function updateWorkspaceNameAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  const parsed = NameSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  updateOrgName(orgId, parsed.data.name)
  return null
}

export async function completeOnboardingAction(): Promise<void> {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const orgId = session.orgId ?? DEFAULT_ORG_ID

  setOrgOnboarded(orgId)
  redirect('/dashboard')
}
