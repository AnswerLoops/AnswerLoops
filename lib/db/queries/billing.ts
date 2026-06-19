import { eq } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { subscriptions } from '../schema'

export interface Subscription {
  id: number
  orgId: number
  planId: string
  status: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

function toSub(row: typeof subscriptions.$inferSelect): Subscription {
  return {
    id: row.id,
    orgId: row.orgId,
    planId: row.planId,
    status: row.status,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripePriceId: row.stripePriceId,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getSubscription(orgId: number): Promise<Subscription | null> {
  const [row] = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1)
  return row ? toSub(row) : null
}

export async function getSubscriptionByStripeId(stripeSubId: string): Promise<Subscription | null> {
  const [row] = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
    .limit(1)
  return row ? toSub(row) : null
}

export async function upsertSubscription(input: {
  orgId: number
  planId: string
  status: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
}): Promise<void> {
  const now = new Date().toISOString()
  await getDb()
    .insert(subscriptions)
    .values({
      orgId: input.orgId,
      planId: input.planId,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripePriceId: input.stripePriceId ?? null,
      currentPeriodStart: input.currentPeriodStart ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ? 1 : 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: subscriptions.orgId,
      set: {
        planId: input.planId,
        status: input.status,
        ...(input.stripeCustomerId !== undefined ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
        ...(input.stripePriceId !== undefined ? { stripePriceId: input.stripePriceId } : {}),
        ...(input.currentPeriodStart !== undefined ? { currentPeriodStart: input.currentPeriodStart } : {}),
        ...(input.currentPeriodEnd !== undefined ? { currentPeriodEnd: input.currentPeriodEnd } : {}),
        ...(input.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: input.cancelAtPeriodEnd ? 1 : 0 } : {}),
        updatedAt: now,
      },
    })
}
