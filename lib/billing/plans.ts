export const TRIAL_DAYS = 14

export type PlanId = 'hobby' | 'pro' | 'scale' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  deflectionsPerMonth: number | null // null = unlimited
  priceMonthly: number               // USD cents, 0 = free
  stripePriceId: string | null       // null = no Stripe product (free)
}

export const PLANS: Record<PlanId, Plan> = {
  hobby: {
    id: 'hobby',
    name: 'Hobby',
    deflectionsPerMonth: 50,
    priceMonthly: 0,
    stripePriceId: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    deflectionsPerMonth: 500,
    priceMonthly: 4900,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    deflectionsPerMonth: 2000,
    priceMonthly: 19900,
    stripePriceId: process.env.STRIPE_PRICE_SCALE ?? null,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    deflectionsPerMonth: null,
    priceMonthly: 59900,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
  },
}

// hobby is a post-trial fallback, not a purchasable plan — excluded from ORDERED_PLANS
export const ORDERED_PLANS: Plan[] = [PLANS.pro, PLANS.scale, PLANS.enterprise]

export function getPlan(id: PlanId | string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'hobby'] ?? PLANS.hobby
}

export function priceIdToPlan(priceId: string): Plan | null {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId) ?? null
}

export function isOverLimit(deflections: number, plan: Plan): boolean {
  if (plan.deflectionsPerMonth === null) return false
  return deflections >= plan.deflectionsPerMonth
}
