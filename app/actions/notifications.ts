'use server'

import { refresh } from 'next/cache'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/db/queries/notifications'

export async function markReadAction(_prevState: unknown, formData: FormData): Promise<null> {
  const id = Number(formData.get('id'))
  if (id) markNotificationRead(id)
  refresh()
  return null
}

export async function markAllReadAction(): Promise<null> {
  markAllNotificationsRead()
  refresh()
  return null
}
