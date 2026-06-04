import type { NextRequest } from 'next/server'
import { removeRepo } from '@/lib/db/queries/github'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  removeRepo(Number(id))
  return Response.json({ ok: true })
}
