import { NextRequest } from 'next/server'
import { getIntegrationByBotSecret, parseChannelIds } from '@/lib/db/queries/integrations'
import { processCommunityMessage } from '@/lib/ingest/pipeline'
import { logger } from '@/lib/logger'

const MOD = 'api/email/ingest'

// Strips quoted reply chains ("On ... wrote:") from email body text.
function stripQuotedReplies(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n')
    .replace(/\nOn [\s\S]+?wrote:\s*$/, '')
    .trim()
}

// Normalise sender: "Jane Smith <jane@example.com>" → { name, email }
function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim() }
  return { name: from.trim(), email: from.trim() }
}

export async function POST(req: NextRequest) {
  // Providers (SendGrid, Mailgun, Postmark, Cloudflare, Resend Inbound) all
  // support a custom secret header we can verify to authenticate the webhook.
  const secret = req.headers.get('x-email-webhook-secret')
  if (!secret) {
    logger.warn('email ingest received without secret', { module: MOD })
    return new Response('Unauthorized', { status: 401 })
  }

  const integration = await getIntegrationByBotSecret(secret)
  if (!integration || integration.platform !== 'email') {
    logger.warn('email ingest secret did not match any org', { module: MOD })
    return new Response('Unauthorized', { status: 401 })
  }

  const orgId = integration.org_id
  const allowedSenders = parseChannelIds(integration) // optional sender filter

  let body: Record<string, unknown>
  const ct = req.headers.get('content-type') ?? ''

  // Support both JSON and form-encoded payloads (SendGrid uses form-data).
  if (ct.includes('application/json')) {
    try {
      body = await req.json() as Record<string, unknown>
    } catch {
      return new Response('Bad Request', { status: 400 })
    }
  } else {
    const fd = await req.formData()
    body = Object.fromEntries(fd.entries())
  }

  const rawFrom = String(body['from'] ?? body['From'] ?? '')
  const subject = String(body['subject'] ?? body['Subject'] ?? '(no subject)')
  const rawText = String(body['text'] ?? body['Text'] ?? body['plain'] ?? '')
  const messageId = String(body['message_id'] ?? body['Message-ID'] ?? body['id'] ?? Date.now())

  if (!rawFrom) {
    logger.warn('email ingest missing from field', { module: MOD, orgId })
    return Response.json({ ok: false, error: 'missing from' }, { status: 400 })
  }

  const { name: senderName, email: senderEmail } = parseSender(rawFrom)

  // Optional: only accept from configured sender addresses/domains
  if (allowedSenders.length > 0) {
    const allowed = allowedSenders.some(
      (s) => senderEmail === s || senderEmail.endsWith(`@${s}`)
    )
    if (!allowed) {
      logger.debug('email from non-monitored sender — skipping', { module: MOD, orgId, senderEmail })
      return Response.json({ ok: true })
    }
  }

  const bodyText = stripQuotedReplies(rawText)
  const content = subject !== '(no subject)' ? `${subject}\n\n${bodyText}` : bodyText

  if (content.trim().length < 10) return Response.json({ ok: true })

  logger.info('email ingest received', { module: MOD, orgId, senderEmail, subject })

  // channelId = "{senderEmail}|{messageId}" — lets sendEmailReply thread the reply
  await processCommunityMessage(
    {
      messageId,
      content,
      authorId: senderEmail,
      authorName: senderName,
      channelId: `${senderEmail}|${messageId}`,
      platform: 'email',
    },
    orgId
  )

  return Response.json({ ok: true })
}
