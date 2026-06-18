import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTicketById, getTicketReplies, getTicketEvents } from '@/lib/db/queries/tickets'
import { StatusBadge, PriorityBadge, CategoryBadge, AIDraftBadge } from '@/components/ui/badge'
import { TicketStatusForm } from '@/components/tickets/ticket-status-form'
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

// Always reflect the latest ticket state (drafts, assessments, feedback).
export const dynamic = 'force-dynamic'

export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const ticket = await getTicketById(Number(id))
  if (!ticket) notFound()

  const replies = await getTicketReplies(ticket.id)
  const events = await getTicketEvents(ticket.id)
  const sla = getSLAStatus(ticket)
  const related = await getRelatedTickets(ticket.id)
  const duplicateCount = related.filter((r) => r.score >= DUPLICATE_THRESHOLD).length
  const assessment = await getAssessment(ticket.id)
  const feedback = await getFeedbackSummary(ticket.id)
  const kbArticle = await getArticleBySourceTicket(ticket.id)
  const resolved = ticket.status === 'resolved' || ticket.status === 'closed'
  const hasAnswer = Boolean(ticket.resolution_notes || ticket.ai_draft)

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
            {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>
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
                    <span className="text-xs text-gray-400">{new Date(reply.created_at).toLocaleString()}</span>
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
                    <span className="text-gray-400 shrink-0">{new Date(event.created_at).toLocaleDateString()}</span>
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
