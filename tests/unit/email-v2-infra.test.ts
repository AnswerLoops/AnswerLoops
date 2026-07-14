import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Structural/infra assertions for Email Channel v2: platform-hosted inbound
// address, RFC Message-ID threading, idempotency, and delivery-status
// tracking. Next.js route modules can't be imported directly in vitest, so
// the ingest route is asserted at the source level; pure helpers in
// lib/email/inbound.ts and lib/email/webhook-verify.ts have real unit tests
// in email-v2-inbound.test.ts / email-v2-webhook-verify.test.ts.

const ROOT = process.cwd()

function readSrc(relPath: string): string {
  const absPath = path.join(ROOT, relPath)
  expect(fs.existsSync(absPath), `File not found: ${relPath}`).toBe(true)
  return fs.readFileSync(absPath, 'utf-8')
}

describe('schema: email_messages + integrations.inbound_address', () => {
  it('defines the emailMessages table with the threading/idempotency columns', async () => {
    const { emailMessages } = await import('../../lib/db/schema')
    const cols = emailMessages as unknown as Record<string, unknown>
    for (const col of ['rfcMessageId', 'providerMessageId', 'inReplyTo', 'ticketId', 'status', 'direction']) {
      expect(cols, col).toHaveProperty(col)
    }
  })

  it('defines inboundAddress on the integrations table', async () => {
    const { integrations } = await import('../../lib/db/schema')
    const cols = integrations as unknown as Record<string, unknown>
    expect(cols).toHaveProperty('inboundAddress')
  })

  it('migration file creates email_messages with a unique rfc_message_id and provider_message_id', () => {
    const sql = readSrc('drizzle/0014_email_v2.sql')
    expect(sql).toMatch(/rfc_message_id TEXT NOT NULL UNIQUE/)
    expect(sql).toMatch(/provider_message_id TEXT UNIQUE/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS inbound_address/)
  })
})

describe('email-messages query layer', () => {
  it('exports the idempotency, threading, and status functions', async () => {
    const q = await import('../../lib/db/queries/email-messages')
    for (const fn of [
      'recordInboundEmail',
      'recordOutboundEmail',
      'updateEmailMessageStatus',
      'setEmailMessageTicket',
      'findTicketByMessageIds',
      'getLatestInboundForTicket',
      'getEmailMessageByRfcId',
      'countRecentOutboundToSender',
      'markStatusByProviderMessageId',
    ]) {
      expect(typeof (q as Record<string, unknown>)[fn], fn).toBe('function')
    }
  })

  it('recordInboundEmail uses onConflictDoNothing on rfc_message_id (idempotency gate)', () => {
    const src = readSrc('lib/db/queries/email-messages.ts')
    expect(src).toMatch(/onConflictDoNothing\(\{ target: emailMessages\.rfcMessageId \}\)/)
  })

  it('findTicketByMessageIds scopes the lookup by orgId (no cross-org thread matches)', () => {
    const src = readSrc('lib/db/queries/email-messages.ts')
    const fnStart = src.indexOf('export async function findTicketByMessageIds')
    const fnBody = src.slice(fnStart, fnStart + 500)
    expect(fnBody).toContain('eq(emailMessages.orgId, orgId)')
  })
})

describe('tickets query layer: customer follow-up handling', () => {
  it('exports recordCustomerReply', async () => {
    const q = await import('../../lib/db/queries/tickets')
    expect(typeof q.recordCustomerReply).toBe('function')
  })

  it('reopens a resolved/closed ticket on a customer reply', () => {
    const src = readSrc('lib/db/queries/tickets.ts')
    const fnStart = src.indexOf('export async function recordCustomerReply')
    const fnBody = src.slice(fnStart, fnStart + 1200)
    expect(fnBody).toMatch(/resolved[\s\S]*closed|closed[\s\S]*resolved/)
    expect(fnBody).toContain("status: 'open'")
    expect(fnBody).toContain("eventType: 'customer_reply'")
  })
})

describe('ingest route: guard chain and threading', () => {
  const src = () => readSrc('app/api/email/ingest/route.ts')

  it('verifies the Resend/Svix webhook signature before trusting the payload', () => {
    expect(src()).toContain('verifyResendWebhook')
  })

  it('still supports the legacy BYO-provider shared-secret path', () => {
    expect(src()).toContain('getIntegrationByBotSecret')
    expect(src()).toContain('x-email-webhook-secret')
  })

  it('resolves the org from the platform-hosted inbound address', () => {
    expect(src()).toContain('getIntegrationByInboundAddress')
  })

  it('runs loop detection before the idempotency insert', () => {
    const s = src()
    const loopIdx = s.indexOf('detectAutoResponse(')
    const idempotencyIdx = s.indexOf('Idempotency gate')
    expect(loopIdx).toBeGreaterThan(-1)
    expect(idempotencyIdx).toBeGreaterThan(-1)
    expect(loopIdx).toBeLessThan(idempotencyIdx)
  })

  it('drops duplicate deliveries via recordInboundEmail returning null', () => {
    const s = src()
    expect(s).toContain('if (!recorded)')
  })

  it('gates on spam verdict after the idempotency insert', () => {
    const s = src()
    const idempotencyIdx = s.indexOf('Idempotency gate')
    const spamIdx = s.indexOf("if (spamVerdict)")
    expect(spamIdx).toBeGreaterThan(idempotencyIdx)
  })

  it('applies a per-sender reply throttle as a loop-guard backstop', () => {
    expect(src()).toContain('countRecentOutboundToSender')
    expect(src()).toContain('REPLY_THROTTLE_MAX')
  })

  it('falls back to HTML-to-text when no plain-text body is present', () => {
    expect(src()).toContain('htmlToText(rawHtml)')
  })

  it('resolves conversation threading via collectThreadIds + findTicketByMessageIds', () => {
    expect(src()).toContain('collectThreadIds(inReplyToHeader, referencesHeader)')
    expect(src()).toContain('findTicketByMessageIds(threadIds, orgId)')
  })

  it('appends matched threads as a customer reply instead of opening a new ticket', () => {
    expect(src()).toContain('recordCustomerReply(existingTicketId')
  })

  it('handles outbound delivery-status webhooks (bounced/complained/delayed) separately from inbound mail', () => {
    const s = src()
    expect(s).toContain('handleDeliveryEvent')
    expect(s).toContain('markStatusByProviderMessageId')
  })

  it('enforces a request size cap and a per-org rate limit', () => {
    const s = src()
    expect(s).toContain('MAX_BODY_BYTES')
    expect(s).toContain('rateLimit(')
  })
})

describe('outbound reply: real Message-ID + References threading', () => {
  const src = () => readSrc('lib/email/reply.ts')

  it('mints and sends an explicit RFC Message-ID header', () => {
    expect(src()).toContain("{ 'Message-ID': rfcMessageId }")
  })

  it('sets In-Reply-To and a full References chain when replying within a thread', () => {
    const s = src()
    expect(s).toContain("headers['In-Reply-To'] = thread.rfc_message_id")
    expect(s).toContain("headers['References'] = references")
    expect(s).toContain('collectThreadIds(thread.in_reply_to, thread.references)')
  })

  it('echoes the original subject with a Re: prefix', () => {
    expect(src()).toContain("`Re: ${subjectBase}`")
  })

  it('persists the send via recordOutboundEmail, including the provider id for delivery-status matching', () => {
    const s = src()
    expect(s).toContain('recordOutboundEmail(')
    expect(s).toContain('providerMessageId: data?.id ?? null')
  })
})

describe('zero-setup connect action', () => {
  it('exports connectPlatformEmailAction', () => {
    // app/actions/integrations.ts pulls in next-auth, which vitest can't
    // resolve outside a Next.js runtime — assert at the source level instead.
    expect(readSrc('app/actions/integrations.ts')).toContain('export async function connectPlatformEmailAction')
  })

  it('generates the inbound address without requiring any user-supplied provider credentials', () => {
    const src = readSrc('app/actions/integrations.ts')
    const fnStart = src.indexOf('export async function connectPlatformEmailAction')
    const fnBody = src.slice(fnStart, fnStart + 1200)
    expect(fnBody).not.toMatch(/formData\.get\(['"](apiKey|provider|webhookSecret)['"]\)/)
    expect(fnBody).toContain('generateUniqueInboundAddress')
  })

  it('treats the inbound address as immutable once set', () => {
    const src = readSrc('app/actions/integrations.ts')
    const fnStart = src.indexOf('export async function connectPlatformEmailAction')
    const fnBody = src.slice(fnStart, fnStart + 800)
    expect(fnBody).toContain('existing?.inbound_address')
  })
})
