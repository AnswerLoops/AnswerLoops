import { getDb } from '../index'
import type { SLAConfig, Priority } from '@/types'

export function getSLAConfigs(): SLAConfig[] {
  return getDb().prepare('SELECT * FROM sla_configs ORDER BY response_hours ASC').all() as SLAConfig[]
}

export function getSLAConfig(priority: Priority): SLAConfig | null {
  return (getDb().prepare('SELECT * FROM sla_configs WHERE priority = ?').get(priority) as SLAConfig) ?? null
}

export function updateSLAConfig(priority: Priority, responseHours: number, resolveHours: number): void {
  getDb().prepare(`
    UPDATE sla_configs
    SET response_hours = ?, resolve_hours = ?, updated_at = datetime('now')
    WHERE priority = ?
  `).run(responseHours, resolveHours, priority)
}
