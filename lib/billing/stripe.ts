import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' })
  }
  return _stripe
}

export async function getOrCreateCustomer(orgId: number, email: string, name: string): Promise<string> {
  const stripe = getStripe()
  const existing = await stripe.customers.search({
    query: `metadata['org_id']:'${orgId}'`,
    limit: 1,
  })
  if (existing.data.length > 0) return existing.data[0].id

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { org_id: String(orgId) },
  })
  return customer.id
}
