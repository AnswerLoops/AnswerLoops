import { eq, and } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { notifications, DEFAULT_ORG_ID } from '../schema'
import type { Notification } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function createNotification(
  type: Notification['type'],
  message: string,
  ticketId?: number,
  orgId = DEFAULT_ORG_ID
): Notification {
  const result = dz()
    .insert(notifications)
    .values({ orgId, type, message, ticketId: ticketId ?? null })
    .run()

  return raw()
    .prepare('SELECT * FROM notifications WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Notification
}

export function getUnreadNotifications(orgId = DEFAULT_ORG_ID): Notification[] {
  return raw()
    .prepare('SELECT * FROM notifications WHERE read = 0 AND org_id = ? ORDER BY created_at DESC')
    .all(orgId) as Notification[]
}

export function getAllNotifications(limit = 50, orgId = DEFAULT_ORG_ID): Notification[] {
  return raw()
    .prepare('SELECT * FROM notifications WHERE org_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(orgId, limit) as Notification[]
}

export function markNotificationRead(id: number): void {
  dz().update(notifications).set({ read: 1 }).where(eq(notifications.id, id)).run()
}

export function markAllNotificationsRead(orgId = DEFAULT_ORG_ID): void {
  dz()
    .update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.orgId, orgId), eq(notifications.read, 0)))
    .run()
}

export function getUnreadCount(orgId = DEFAULT_ORG_ID): number {
  const row = raw()
    .prepare('SELECT COUNT(*) as n FROM notifications WHERE read = 0 AND org_id = ?')
    .get(orgId) as { n: number }
  return row.n
}
