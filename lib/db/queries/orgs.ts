import { eq } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { orgs } from '../schema'

export interface Org {
  id: number
  name: string
  slug: string | null
  onboarded_at: string | null
  widget_token: string | null
  widget_token_expires_at: string | null
  created_at: string
}

export async function getOrg(orgId: number): Promise<Org | null> {
  const db = getDb()
  const [row] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    onboarded_at: row.onboardedAt,
    widget_token: row.widgetToken,
    widget_token_expires_at: row.widgetTokenExpiresAt,
    created_at: row.createdAt,
  }
}

export async function updateOrgName(orgId: number, name: string): Promise<void> {
  await getDb().update(orgs).set({ name }).where(eq(orgs.id, orgId))
}

export async function setOrgOnboarded(orgId: number): Promise<void> {
  await getDb()
    .update(orgs)
    .set({ onboardedAt: new Date().toISOString() })
    .where(eq(orgs.id, orgId))
}

export async function isOrgOnboarded(orgId: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ onboardedAt: orgs.onboardedAt })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1)
  return !!row?.onboardedAt
}
