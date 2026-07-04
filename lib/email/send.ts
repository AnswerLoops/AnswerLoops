import { Resend } from 'resend'
import { getOrgMembers } from '@/lib/db/queries/members'
import { MOCK_EXTERNALS } from '@/lib/mock-mode'
import type { Ticket } from '@/types'

function client() {
  return new Resend(process.env.RESEND_API_KEY)
}

function from() {
  return process.env.RESEND_FROM ?? 'notifications@yourdomain.com'
}

async function getAdminEmails(orgId: number): Promise<string[]> {
  const members = await getOrgMembers(orgId)
  return members
    .filter((m) => m.email && ['owner', 'admin'].includes(m.role))
    .map((m) => m.email as string)
}

const BASE_STYLE = `font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px`
const MUTED = `color:#6b7280;font-size:14px`
const BADGE: Record<string, string> = {
  critical: 'background:#fee2e2;color:#991b1b',
  high: 'background:#ffedd5;color:#9a3412',
  medium: 'background:#fef9c3;color:#854d0e',
  low: 'background:#f0fdf4;color:#166534',
}

function priorityBadge(priority: string) {
  const style = BADGE[priority] ?? 'background:#f3f4f6;color:#374151'
  return `<span style="${style};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:uppercase">${priority}</span>`
}

function ticketLink(ticketId: number) {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return `${base}/tickets/${ticketId}`
}

export async function sendNewTicketEmail(ticket: Ticket, orgId: number): Promise<void> {
  if (MOCK_EXTERNALS || !process.env.RESEND_API_KEY) return
  if (!['critical', 'high'].includes(ticket.priority)) return

  const to = await getAdminEmails(orgId)
  if (to.length === 0) return

  const summary = ticket.ai_summary ?? ticket.content.slice(0, 120)
  const author = ticket.discord_author_name ?? 'Community member'
  const url = ticketLink(ticket.id)

  await client().emails.send({
    from: from(),
    to,
    subject: `[${ticket.priority.toUpperCase()}] New ticket #${ticket.id}: ${summary.slice(0, 60)}`,
    html: `
      <div style="${BASE_STYLE}">
        <p style="margin-bottom:4px">${priorityBadge(ticket.priority)}</p>
        <h2 style="font-size:18px;font-weight:600;color:#111827;margin:8px 0">
          New community ticket #${ticket.id}
        </h2>
        <p style="${MUTED};margin-bottom:4px"><strong>From:</strong> ${author}</p>
        <p style="${MUTED};margin-bottom:16px"><strong>Summary:</strong> ${summary}</p>
        <a href="${url}"
           style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none">
          View ticket
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">${url}</p>
      </div>
    `,
  })
}

export async function sendTicketResolvedEmail(
  ticket: Ticket,
  resolvedBy: string,
  orgId: number
): Promise<void> {
  if (MOCK_EXTERNALS || !process.env.RESEND_API_KEY) return

  const to = await getAdminEmails(orgId)
  if (to.length === 0) return

  const summary = ticket.ai_summary ?? ticket.content.slice(0, 120)
  const url = ticketLink(ticket.id)

  await client().emails.send({
    from: from(),
    to,
    subject: `Ticket #${ticket.id} resolved by ${resolvedBy}`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="font-size:18px;font-weight:600;color:#111827;margin-bottom:8px">
          Ticket #${ticket.id} resolved
        </h2>
        <p style="${MUTED};margin-bottom:4px"><strong>Resolved by:</strong> ${resolvedBy}</p>
        <p style="${MUTED};margin-bottom:4px"><strong>Summary:</strong> ${summary}</p>
        ${ticket.resolution_notes ? `<p style="${MUTED};margin-bottom:16px"><strong>Notes:</strong> ${ticket.resolution_notes}</p>` : '<p style="margin-bottom:16px"></p>'}
        <a href="${url}"
           style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none">
          View ticket
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">${url}</p>
      </div>
    `,
  })
}

export async function sendWaitlistConfirmation(email: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const from = process.env.RESEND_WAITLIST_FROM ?? process.env.RESEND_FROM ?? 'hello@answerloops.com'

  const result = await client().emails.send({
    from,
    to: [email],
    subject: "You're on the AnswerLoops waitlist",
    html: `
      <div style="${BASE_STYLE}">
        <img src="https://answerloops.com/logo.png" alt="AnswerLoops" style="height:48px;margin-bottom:24px" />
        <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px">
          You're on the list.
        </h2>
        <p style="${MUTED};margin-bottom:16px">
          Thanks for your interest in AnswerLoops — AI-powered support for developer communities.
          We'll email you the moment we open early access.
        </p>
        <p style="${MUTED};margin-bottom:24px">
          In the meantime, you can self-host the open-source version right now:
        </p>
        <a href="https://github.com/AnswerLoops/AnswerLoops"
           style="display:inline-block;background:#111827;color:#fff;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none">
          View on GitHub
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px">
          You're receiving this because you signed up at answerloops.com.
          No further emails until we launch.
        </p>
      </div>
    `,
  })
}

export async function sendSlaBreachEmails(ticketIds: number[], orgId: number): Promise<void> {
  if (MOCK_EXTERNALS || !process.env.RESEND_API_KEY) return
  if (ticketIds.length === 0) return

  const to = await getAdminEmails(orgId)
  if (to.length === 0) return

  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const ticketLinks = ticketIds
    .map(
      (id) =>
        `<li><a href="${base}/tickets/${id}" style="color:#4f46e5">Ticket #${id}</a></li>`
    )
    .join('')

  await client().emails.send({
    from: from(),
    to,
    subject: `SLA breach: ${ticketIds.length} ticket${ticketIds.length > 1 ? 's' : ''} overdue`,
    html: `
      <div style="${BASE_STYLE}">
        <h2 style="font-size:18px;font-weight:600;color:#991b1b;margin-bottom:8px">
          SLA breach alert
        </h2>
        <p style="${MUTED};margin-bottom:16px">
          ${ticketIds.length} ticket${ticketIds.length > 1 ? 's have' : ' has'} missed their SLA deadline:
        </p>
        <ul style="padding-left:20px;${MUTED}">${ticketLinks}</ul>
        <p style="margin-top:24px">
          <a href="${base}/tickets"
             style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none">
            View all tickets
          </a>
        </p>
      </div>
    `,
  })
}
