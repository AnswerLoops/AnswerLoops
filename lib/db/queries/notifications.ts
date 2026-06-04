import { getDb } from '../index'
import type { Notification } from '@/types'

export function createNotification(
  type: Notification['type'],
  message: string,
  ticketId?: number
): Notification {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO notifications (type, message, ticket_id)
    VALUES (?, ?, ?)
  `).run(type, message, ticketId ?? null)
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid) as Notification
}

export function getUnreadNotifications(): Notification[] {
  return getDb().prepare('SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC').all() as Notification[]
}

export function getAllNotifications(limit = 50): Notification[] {
  return getDb().prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?').all(limit) as Notification[]
}

export function markNotificationRead(id: number): void {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id)
}

export function markAllNotificationsRead(): void {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE read = 0').run()
}

export function getUnreadCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as n FROM notifications WHERE read = 0').get() as { n: number }).n
}
