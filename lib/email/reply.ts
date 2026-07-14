import { randomUUID } from 'node:crypto'
import { Resend } from 'resend'
import { getIntegration } from '@/lib/db/queries/integrations'
import { getLatestInboundForTicket, recordOutboundEmail } from '@/lib/db/queries/email-messages'
import { collectThreadIds } from '@/lib/email/inbound'
import { logger } from '@/lib/logger'

const MOD = 'email/reply'
const DEFAULT_DOMAIN = 'inbox.answerloops.app'

function newMessageId(domain: string): string {
  return `<${randomUUID()}@${domain}>`
}

// channelId for email = "{toAddress}|{messageId}" — legacy fallback only, used
// when there's no ticketId (or no recorded inbound thread) to resolve from.
export async function sendEmailReply(
  channelId: string,
  content: string,
  orgId: number,
  ticketId?: number
): Promise<string | null> {
  const [fallbackToAddress] = channelId.split('|')

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — cannot send email reply', { module: MOD, orgId })
    return null
  }

  const integration = await getIntegration(orgId, 'email')
  // bot_token doubles as a custom From-address override for BYO-provider orgs.
  const fromAddress = integration?.bot_token ?? process.env.RESEND_FROM ?? 'support@yourdomain.com'
  const fromDomain = fromAddress.split('@')[1] ?? DEFAULT_DOMAIN

  const thread = ticketId ? await getLatestInboundForTicket(ticketId, orgId) : null
  const toAddress = thread?.from_addr ?? fallbackToAddress
  if (!toAddress) return null

  const subjectBase = thread?.subject?.replace(/^\s*re:\s*/i, '').trim() || 'Your support request'
  const subject = `Re: ${subjectBase}`

  const rfcMessageId = newMessageId(fromDomain)
  const headers: Record<string, string> = { 'Message-ID': rfcMessageId }
  let references: string | null = null
  if (thread) {
    const priorRefs = collectThreadIds(thread.in_reply_to, thread.references)
    references = [...priorRefs, thread.rfc_message_id].join(' ')
    headers['In-Reply-To'] = thread.rfc_message_id
    headers['References'] = references
  }

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject,
      text: content,
      headers,
    })

    if (error) {
      logger.error('Resend reply failed', { module: MOD, orgId, ticketId, error })
      return null
    }

    if (ticketId) {
      await recordOutboundEmail({
        orgId,
        rfcMessageId,
        providerMessageId: data?.id ?? null,
        inReplyTo: thread?.rfc_message_id ?? null,
        references,
        ticketId,
        fromAddr: fromAddress,
        toAddr: toAddress,
        subject,
      })
    }

    return rfcMessageId
  } catch (err) {
    logger.error('email reply threw', { module: MOD, orgId, ticketId, error: err })
    return null
  }
}
