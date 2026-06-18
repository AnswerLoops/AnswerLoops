import { eq, and, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { notifications, DEFAULT_ORG_ID } from '../schema'
import type { Notification } from '@/types'

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    ticket_id: row.ticketId,
    type: row.type as Notification['type'],
    message: row.message,
    read: row.read as 0 | 1,
    created_at: row.createdAt,
  }
}

export async function createNotification(
  type: Notification['type'],
  message: string,
  ticketId?: number,
  orgId = DEFAULT_ORG_ID
): Promise<Notification> {
  const [row] = await getDb()
    .insert(notifications)
    .values({ orgId, type, message, ticketId: ticketId ?? null })
    .returning()
  return toNotification(row)
}

export async function getUnreadNotifications(orgId = DEFAULT_ORG_ID): Promise<Notification[]> {
  const rows = await getDb()
    .select()
    .from(notifications)
    .where(and(eq(notifications.orgId, orgId), eq(notifications.read, 0)))
    .orderBy(desc(notifications.createdAt))
  return rows.map(toNotification)
}

export async function getAllNotifications(limit = 50, orgId = DEFAULT_ORG_ID): Promise<Notification[]> {
  const rows = await getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.orgId, orgId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
  return rows.map(toNotification)
}

export async function markNotificationRead(id: number): Promise<void> {
  await getDb().update(notifications).set({ read: 1 }).where(eq(notifications.id, id))
}

export async function markAllNotificationsRead(orgId = DEFAULT_ORG_ID): Promise<void> {
  await getDb()
    .update(notifications)
    .set({ read: 1 })
    .where(and(eq(notifications.orgId, orgId), eq(notifications.read, 0)))
}

export async function getUnreadCount(orgId = DEFAULT_ORG_ID): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.orgId, orgId), eq(notifications.read, 0)))
  return row?.n ?? 0
}
