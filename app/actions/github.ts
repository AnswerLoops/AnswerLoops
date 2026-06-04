'use server'

import { z } from 'zod'
import { refresh } from 'next/cache'
import { addRepo, removeRepo } from '@/lib/db/queries/github'

const AddRepoSchema = z.object({
  installationId: z.coerce.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  isPrivate: z.coerce.boolean().optional(),
})

export async function addRepoAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const parsed = AddRepoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid input' }

  try {
    addRepo(parsed.data.installationId, parsed.data.owner, parsed.data.repo, parsed.data.isPrivate ?? false)
  } catch (err) {
    return { error: String(err) }
  }

  refresh()
  return null
}

export async function removeRepoAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const id = Number(formData.get('id'))
  if (!id) return { error: 'Invalid id' }
  removeRepo(id)
  refresh()
  return null
}
