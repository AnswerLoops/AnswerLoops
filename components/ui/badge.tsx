import type { TicketStatus, Priority, TicketCategory, AIDraftStatus } from '@/types'

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
}

const priorityColors: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
}

const categoryColors: Record<TicketCategory, string> = {
  critical_bug: 'bg-red-100 text-red-800',
  bug: 'bg-orange-100 text-orange-800',
  feature_request: 'bg-purple-100 text-purple-800',
  general_question: 'bg-blue-100 text-blue-800',
}

const draftColors: Record<AIDraftStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  posted: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  overridden: 'bg-gray-100 text-gray-500',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge label={status.replace('_', ' ')} className={statusColors[status]} />
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge label={priority} className={priorityColors[priority]} />
}

export function CategoryBadge({ category }: { category: TicketCategory }) {
  const label = category.replace(/_/g, ' ')
  return <Badge label={label} className={categoryColors[category]} />
}

export function AIDraftBadge({ status }: { status: AIDraftStatus }) {
  const labels: Record<AIDraftStatus, string> = {
    pending: 'AI pending',
    posted: 'AI draft posted',
    approved: 'AI approved',
    overridden: 'AI overridden',
  }
  return <Badge label={labels[status]} className={draftColors[status]} />
}
