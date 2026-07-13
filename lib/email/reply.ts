import { Resend } from 'resend'
import { getIntegration } from '@/lib/db/queries/integrations'
import { logger } from '@/lib/logger'

const MOD = 'email/reply'

// channelId for email = "{toAddress}|{messageId}" so we can thread replies
export async function sendEmailReply(
  channelId: string,
  content: string,
  orgId: number
): Promise<string | null> {
  const [toAddress, inReplyTo] = channelId.split('|')
  if (!toAddress) return null

  const integration = await getIntegration(orgId, 'email')
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — cannot send email reply', { module: MOD, orgId })
    return null
  }

  const fromAddress = integration?.bot_token ?? process.env.RESEND_FROM ?? 'support@yourdomain.com'

  const headers: Record<string, string> = {}
  if (inReplyTo) headers['In-Reply-To'] = inReplyTo

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: 'Re: Your support request',
      text: content,
      headers,
    })

    if (error) {
      logger.error('Resend reply failed', { module: MOD, orgId, error })
      return null
    }

    return data?.id ?? null
  } catch (err) {
    logger.error('email reply threw', { module: MOD, orgId, error: err })
    return null
  }
}
