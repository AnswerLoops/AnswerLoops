export const TRIAL_DAYS = 14

export type PlanId = 'hobby' | 'pro' | 'scale' | 'enterprise'

// Annual billing discount shown on the marketing pricing page. There is no
// separate Stripe annual price configured yet — checkout always runs the
// monthly price regardless of which toggle state the visitor was on. This
// is a display-only rate until the product leaves waitlist mode and annual
// Stripe prices exist to sell against.
export const ANNUAL_DISCOUNT_PCT = 20

export interface Plan {
  id: PlanId
  name: string
  deflectionsPerMonth: number | null // null = unlimited
  priceMonthly: number               // USD cents, 0 = free
  stripePriceId: string | null       // null = no Stripe product (free)
}

// Effective monthly price if billed annually (priceMonthly minus the annual
// discount), rounded to the nearest cent. Display-only — see note above.
export function annualMonthlyPrice(plan: Plan): number {
  return Math.round(plan.priceMonthly * (1 - ANNUAL_DISCOUNT_PCT / 100))
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
    priceMonthly: 2900,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    deflectionsPerMonth: 2000,
    priceMonthly: 7900,
    stripePriceId: process.env.STRIPE_PRICE_SCALE ?? null,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    deflectionsPerMonth: null,
    priceMonthly: 29900,
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
