import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/billing/stripe'
import { upsertSubscription, getSubscriptionByStripeId } from '@/lib/db/queries/billing'
import { priceIdToPlan } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Stripe requires raw body for signature verification — disable body parsing.
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not set', { module: 'billing/webhook' })
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = getStripe().webhooks.constructEvent(body, sig ?? '', webhookSecret)
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { module: 'billing/webhook', error: err })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const MOD = 'billing/webhook'

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId = Number(session.metadata?.org_id)
        const planId = session.metadata?.plan_id ?? 'hobby'
        if (!orgId) break

        await upsertSubscription({
          orgId,
          planId,
          status: 'trialing',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        })
        logger.info('Trial started via checkout', { module: MOD, orgId })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = Number(sub.metadata?.org_id)
        if (!orgId) break

        const priceId = sub.items.data[0]?.price?.id ?? null
        const plan = priceId ? priceIdToPlan(priceId) : null
        const subAny = sub as unknown as {
          current_period_start: number
          current_period_end: number
          trial_end: number | null
        }
        const trialEndsAt = subAny.trial_end
          ? new Date(subAny.trial_end * 1000).toISOString()
          : null

        await upsertSubscription({
          orgId,
          planId: plan?.id ?? 'pro',
          status: sub.status,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          currentPeriodStart: new Date(subAny.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subAny.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          trialEndsAt,
        })
        logger.info('Subscription updated', { module: MOD, orgId, status: sub.status })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = Number(sub.metadata?.org_id)
        if (!orgId) break

        await upsertSubscription({
          orgId,
          planId: 'hobby',
          status: 'canceled',
          stripeSubscriptionId: sub.id,
          cancelAtPeriodEnd: false,
        })
        logger.info('Subscription canceled — downgraded to hobby', { module: MOD, orgId })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceAny = invoice as unknown as {
          subscription?: string | null
          subscription_details?: { metadata?: { org_id?: string } }
        }
        const subId = invoiceAny.subscription ?? null
        if (!subId) break

        const orgId = Number(invoiceAny.subscription_details?.metadata?.org_id)
        if (!orgId) break

        const existingSub = await getSubscriptionByStripeId(subId)
        await upsertSubscription({
          orgId,
          planId: existingSub?.planId ?? 'pro',
          status: 'past_due',
          stripeSubscriptionId: subId,
        })
        logger.warn('Payment failed — subscription past_due', { module: MOD, orgId })
        break
      }

      default:
        break
    }
  } catch (err) {
    logger.error('Webhook handler error', { module: MOD, event: event.type, error: err })
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
