import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/db/queries/billing'
import { checkDeflectionLimit } from '@/lib/billing/usage'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const [sub, usage] = await Promise.all([
    getSubscription(orgId),
    checkDeflectionLimit(orgId),
  ])

  return NextResponse.json({
    planId: usage.planId,
    status: sub?.status ?? 'active',
    used: usage.used,
    limit: usage.limit,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  })
}
