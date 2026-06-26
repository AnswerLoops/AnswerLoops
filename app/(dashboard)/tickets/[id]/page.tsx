import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTicketById, getTicketReplies, getTicketEvents } from '@/lib/db/queries/tickets'
import { StatusBadge, PriorityBadge, CategoryBadge, AIDraftBadge } from '@/components/ui/badge'
import { TicketStatusForm } from '@/components/tickets/ticket-status-form'
import { DeleteTicketButton } from '@/components/tickets/delete-ticket-button'
import { auth } from '@/auth'
import { getOrgMembers } from '@/lib/db/queries/members'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'
import { ReplyForm } from '@/components/tickets/reply-form'
import { AIDraftPanel } from '@/components/tickets/ai-draft-panel'
import { getSLAStatus } from '@/lib/sla/engine'
import { getRelatedTickets } from '@/lib/db/queries/embeddings'
import { DUPLICATE_THRESHOLD } from '@/lib/ai/related'
import { getAssessment } from '@/lib/db/queries/assessments'
import { getFeedbackSummary } from '@/lib/db/queries/feedback'
import { FeedbackButtons } from '@/components/tickets/feedback-buttons'
import { getArticleBySourceTicket } from '@/lib/db/queries/kb'
import { PromoteKBButton } from '@/components/tickets/promote-kb-button'
import { LocalDate } from '@/components/ui/local-date'

// Always reflect the latest ticket state (drafts, assessments, feedback).
export const dynamic = 'force-dynamic'

export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const ticket = await getTicketById(Number(id))
  if (!ticket) notFound()

  const [replies, events, related, assessment, feedback, kbArticle, session, members] = await Promise.all([
    getTicketReplies(ticket.id),
    getTicketEvents(ticket.id),
    getRelatedTickets(ticket.id),
    getAssessment(ticket.id),
    getFeedbackSummary(ticket.id),
    getArticleBySourceTicket(ticket.id),
    auth(),
    getOrgMembers(DEFAULT_ORG_ID),
  ])

  const sla = getSLAStatus(ticket)
  const duplicateCount = related.filter((r) => r.score >= DUPLICATE_THRESHOLD).length
  const resolved = ticket.status === 'resolved' || ticket.status === 'closed'
  const hasAnswer = Boolean(ticket.resolution_notes || ticket.ai_draft)

  const currentUserId = session?.user?.id ? Number(session.user.id) : null
  const isOwner = members.find((m) => m.user_id === currentUserId)?.role === 'owner'

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back navigation */}
      <Link href="/tickets" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
        ← Back to tickets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-gray-400">#{ticket.id}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.category && <CategoryBadge category={ticket.category} />}
            <AIDraftBadge status={ticket.ai_draft_status} />
            {sla.anyBreached && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">SLA breached</span>
            )}
            {duplicateCount > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Asked {duplicateCount + 1}×
              </span>
            )}
            {assessment && (
              assessment.auto_deflected === 1 ? (
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  Auto-answered {Math.round(assessment.confidence * 100)}%
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Needs review {Math.round(assessment.confidence * 100)}%
                </span>
              )
            )}
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            {ticket.ai_summary ?? ticket.content.slice(0, 120)}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            From {ticket.discord_author_name ?? 'Unknown'} ·{' '}
            <LocalDate iso={ticket.created_at} time />
          </p>
          {ticket.discord_guild_id && ticket.discord_channel_id && ticket.discord_message_id && (
            <a
              href={`https://discord.com/channels/${ticket.discord_guild_id}/${ticket.discord_channel_id}/${ticket.discord_message_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054A19.9 19.9 0 0 0 5.9 20.89a.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028A19.839 19.839 0 0 0 23.9 18.11a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              View in Discord ↗
            </a>
          )}
        </div>
        {isOwner && <DeleteTicketButton ticketId={ticket.id} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Original message */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Original Message</h2>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.content}</p>
          </div>

          {/* AI Draft */}
          {ticket.ai_draft && ticket.ai_draft_status !== 'pending' && (
            <AIDraftPanel
              ticketId={ticket.id}
              draft={ticket.ai_draft}
              status={ticket.ai_draft_status}
            />
          )}
          {ticket.ai_draft_status === 'pending' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
              AI agent is generating an answer from GitHub source code…
            </div>
          )}

          {/* Confidence assessment */}
          {assessment && (
            <div className={`rounded-lg border px-4 py-3 ${assessment.auto_deflected === 1 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  AI Confidence
                </span>
                <span className={`text-xs font-semibold ${assessment.auto_deflected === 1 ? 'text-green-700' : 'text-amber-700'}`}>
                  {Math.round(assessment.confidence * 100)}% · {assessment.auto_deflected === 1 ? 'auto-answered' : 'needs human review'}
                </span>
              </div>
              {assessment.reasoning && (
                <p className="text-xs text-gray-600">{assessment.reasoning}</p>
              )}
              <div className="mt-3 border-t border-gray-200/70 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Was this answer good?</p>
                <FeedbackButtons ticketId={ticket.id} summary={feedback} />
              </div>
            </div>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Replies</h2>
              {replies.map((reply) => (
                <div key={reply.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">{reply.staff_name}</span>
                    <span className="text-xs text-gray-400"><LocalDate iso={reply.created_at} time /></span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Reply</h2>
            <ReplyForm ticketId={ticket.id} />
          </div>
        </div>

        {/* Right: metadata + status */}
        <div className="space-y-4">
          {/* Ticket info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</h2>
            <dl className="space-y-2 text-sm">
              {ticket.severity_score !== null && (
                <div>
                  <dt className="text-xs text-gray-500">Severity</dt>
                  <dd className="font-medium">{(ticket.severity_score * 100).toFixed(0)}%</dd>
                </div>
              )}
              {ticket.sla_response_deadline && (
                <div>
                  <dt className="text-xs text-gray-500">Response deadline</dt>
                  <dd className={`font-medium text-xs ${sla.responseBreached ? 'text-red-600' : 'text-gray-700'}`}>
                    {new Date(ticket.sla_response_deadline).toLocaleString()}
                    {sla.responseBreached ? ' (breached)' : ticket.sla_response_met === 1 ? ' (met)' : ''}
                  </dd>
                </div>
              )}
              {ticket.sla_resolve_deadline && (
                <div>
                  <dt className="text-xs text-gray-500">Resolve deadline</dt>
                  <dd className={`font-medium text-xs ${sla.resolveBreached ? 'text-red-600' : 'text-gray-700'}`}>
                    {new Date(ticket.sla_resolve_deadline).toLocaleString()}
                    {sla.resolveBreached ? ' (breached)' : ticket.sla_resolve_met === 1 ? ' (met)' : ''}
                  </dd>
                </div>
              )}
              {ticket.discord_author_name && (
                <div>
                  <dt className="text-xs text-gray-500">Discord user</dt>
                  <dd>{ticket.discord_author_name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Related questions */}
          {related.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Related Questions</h2>
              <ul className="space-y-2.5">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/tickets/${r.id}`} className="group block">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs text-gray-400">#{r.id}</span>
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-gray-400 ml-auto">{(r.score * 100).toFixed(0)}% match</span>
                      </div>
                      <p className="text-sm text-gray-700 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {r.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Update status */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Update Status</h2>
            <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
          </div>

          {/* Knowledge base */}
          {(resolved && hasAnswer) || kbArticle ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Knowledge Base</h2>
              <PromoteKBButton ticketId={ticket.id} articleId={kbArticle?.id} />
              {!kbArticle && (
                <p className="mt-2 text-xs text-gray-400">Publish this answer as a searchable KB article.</p>
              )}
            </div>
          ) : null}

          {/* Event log */}
          {events.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity</h2>
              <ul className="space-y-2">
                {events.map((event) => (
                  <li key={event.id} className="text-xs text-gray-600 flex gap-1.5">
                    <span className="text-gray-400 shrink-0"><LocalDate iso={event.created_at} /></span>
                    <span>
                      {event.actor && <strong>{event.actor}</strong>}{' '}
                      {event.event_type.replace(/_/g, ' ')}
                      {event.old_value && event.new_value && ` (${event.old_value} → ${event.new_value})`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
