import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe, getOrCreateCustomer } from '@/lib/billing/stripe'
import { getPlan, TRIAL_DAYS } from '@/lib/billing/plans'
import { getSubscription } from '@/lib/db/queries/billing'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { getDb } from '@/lib/db/drizzle'
import { users, memberships } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.orgId ?? DEFAULT_ORG_ID
  const { planId } = await req.json() as { planId: string }
  const plan = getPlan(planId)

  if (!plan.stripePriceId) {
    return NextResponse.json({ error: 'No Stripe price for this plan' }, { status: 400 })
  }

  // Get owner email for the customer record
  const db = getDb()
  const [member] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.orgId, orgId), eq(memberships.role, 'owner')))
    .limit(1)

  const email = member?.email ?? session.user.email ?? ''
  const name = member?.name ?? session.user.name ?? ''

  const existing = await getSubscription(orgId)
  const customerId = existing?.stripeCustomerId
    ?? await getOrCreateCustomer(orgId, email, name)

  const stripe = getStripe()
  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/billing?success=1`,
    cancel_url: `${baseUrl}/billing?canceled=1`,
    metadata: { org_id: String(orgId), plan_id: plan.id },
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { org_id: String(orgId), plan_id: plan.id },
    },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
