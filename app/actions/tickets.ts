'use server'

import { z } from 'zod'
import { refresh } from 'next/cache'
import {
  updateTicketStatus,
  addTicketReply,
  updateTicketAIDraftStatus,
} from '@/lib/db/queries/tickets'
import { sendToChannel } from '@/lib/discord/send'
import { getTicketById } from '@/lib/db/queries/tickets'
import { auth } from '@/auth'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { sendTicketResolvedEmail } from '@/lib/email/send'
import { logger } from '@/lib/logger'

const UpdateStatusSchema = z.object({
  ticketId: z.coerce.number(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  staffName: z.string().min(1).max(100),
  resolutionNotes: z.string().optional(),
})

export async function updateTicketStatusAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const parsed = UpdateStatusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.status?.[0] ?? 'Invalid input' }
  }

  const { ticketId, status, staffName, resolutionNotes } = parsed.data

  try {
    await updateTicketStatus(ticketId, status, staffName, resolutionNotes)
  } catch (err) {
    return { error: String(err) }
  }

  if (status === 'resolved' || status === 'closed') {
    const session = await auth()
    const orgId = session?.orgId ?? DEFAULT_ORG_ID
    const ticket = await getTicketById(ticketId)
    if (ticket) {
      sendTicketResolvedEmail(ticket, staffName, orgId).catch((err) =>
        logger.error('sendTicketResolvedEmail failed', { module: 'actions/tickets', error: err })
      )
    }
  }

  refresh()
  return null
}

const PostReplySchema = z.object({
  ticketId: z.coerce.number(),
  staffName: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
})

export async function postReplyAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const parsed = PostReplySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  const { ticketId, staffName, content } = parsed.data
  const ticket = await getTicketById(ticketId)
  if (!ticket) return { error: 'Ticket not found' }

  // Post to Discord
  const channelId = ticket.discord_thread_id ?? ticket.discord_channel_id
  let discordMsgId: string | undefined

  if (channelId) {
    const message = `**[Response from ${staffName}]:** ${content}`
    const msgId = await sendToChannel(channelId, message)
    discordMsgId = msgId ?? undefined
  }

  // Save reply
  await addTicketReply(ticketId, staffName, content, discordMsgId)

  refresh()
  return null
}

const UpdateDraftSchema = z.object({
  ticketId: z.coerce.number(),
  action: z.enum(['approve', 'override', 'edit']),
  newDraft: z.string().optional(),
})

export async function updateAIDraftAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  const parsed = UpdateDraftSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid input' }

  const { ticketId, action, newDraft } = parsed.data
  const ticket = await getTicketById(ticketId)
  if (!ticket) return { error: 'Ticket not found' }

  if (action === 'approve') {
    await updateTicketAIDraftStatus(ticketId, 'approved')
  } else if (action === 'override') {
    await updateTicketAIDraftStatus(ticketId, 'overridden')
  } else if (action === 'edit' && newDraft) {
    await updateTicketAIDraftStatus(ticketId, 'approved', newDraft)
    // Post edited draft to Discord
    const channelId = ticket.discord_thread_id ?? ticket.discord_channel_id
    if (channelId) {
      await sendToChannel(channelId, `**[Updated AI Answer]**\n${newDraft}`)
    }
  }

  refresh()
  return null
}
