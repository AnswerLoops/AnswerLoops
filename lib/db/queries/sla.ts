import { eq, asc } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { slaConfigs } from '../schema'
import type { SLAConfig, Priority } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function getSLAConfigs(): SLAConfig[] {
  return raw()
    .prepare('SELECT * FROM sla_configs ORDER BY response_hours ASC')
    .all() as SLAConfig[]
}

export function getSLAConfig(priority: Priority): SLAConfig | null {
  return (raw().prepare('SELECT * FROM sla_configs WHERE priority = ?').get(priority) as SLAConfig) ?? null
}

export function updateSLAConfig(priority: Priority, responseHours: number, resolveHours: number): void {
  dz()
    .update(slaConfigs)
    .set({ responseHours, resolveHours, updatedAt: new Date().toISOString() })
    .where(eq(slaConfigs.priority, priority))
    .run()
}
