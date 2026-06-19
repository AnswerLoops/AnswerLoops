import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/billing/stripe'
import { getSubscription } from '@/lib/db/queries/billing'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const sub = await getSubscription(orgId)

  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const stripe = getStripe()
  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${baseUrl}/billing`,
  })

  return NextResponse.json({ url: portalSession.url })
}
