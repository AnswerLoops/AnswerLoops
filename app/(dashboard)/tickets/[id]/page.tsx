import { notFound } from 'next/navigation'
import { getTicketById, getTicketReplies, getTicketEvents } from '@/lib/db/queries/tickets'
import { StatusBadge, PriorityBadge, CategoryBadge, AIDraftBadge } from '@/components/ui/badge'
import { TicketStatusForm } from '@/components/tickets/ticket-status-form'
import { ReplyForm } from '@/components/tickets/reply-form'
import { AIDraftPanel } from '@/components/tickets/ai-draft-panel'
import { getSLAStatus } from '@/lib/sla/engine'

export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const ticket = getTicketById(Number(id))
  if (!ticket) notFound()

  const replies = getTicketReplies(ticket.id)
  const events = getTicketEvents(ticket.id)
  const sla = getSLAStatus(ticket)

  return (
    <div className="max-w-4xl space-y-6">
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

          {/* Update status */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Update Status</h2>
            <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
          </div>

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
