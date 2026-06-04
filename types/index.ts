export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketCategory = 'critical_bug' | 'bug' | 'feature_request' | 'general_question'
export type AIDraftStatus = 'pending' | 'posted' | 'approved' | 'overridden'

export interface Ticket {
  id: number
  discord_message_id: string | null
  discord_channel_id: string | null
  discord_thread_id: string | null
  discord_author_id: string | null
  discord_author_name: string | null
  content: string
  // AI triage
  category: TicketCategory | null
  severity_score: number | null
  ai_summary: string | null
  ai_suggested_priority: Priority | null
  // AI agent draft
  ai_draft: string | null
  ai_draft_status: AIDraftStatus
  ai_draft_posted_at: string | null
  // Lifecycle
  priority: Priority
  status: TicketStatus
  resolution_notes: string | null
  // SLA
  sla_response_deadline: string | null
  sla_resolve_deadline: string | null
  sla_response_met: 0 | 1 | null
  sla_resolve_met: 0 | 1 | null
  first_response_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface TicketReply {
  id: number
  ticket_id: number
  staff_name: string
  content: string
  discord_msg_id: string | null
  created_at: string
}

export interface TicketEvent {
  id: number
  ticket_id: number
  event_type: string
  old_value: string | null
  new_value: string | null
  actor: string | null
  created_at: string
}

export interface SLAConfig {
  id: number
  priority: Priority
  response_hours: number
  resolve_hours: number
  updated_at: string
}

export interface FAQSnapshot {
  id: number
  week_start: string
  week_end: string
  content: string
  ticket_count: number
  generated_at: string
}

export interface GitHubRepo {
  id: number
  installation_id: number
  owner: string
  repo: string
  is_private: 0 | 1
  added_at: string
}

export interface Notification {
  id: number
  ticket_id: number | null
  type: 'new_question' | 'sla_breach' | 'ai_draft_ready'
  message: string
  read: 0 | 1
  created_at: string
}

export interface PushSubscription {
  id: number
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export interface TriageResult {
  category: TicketCategory
  severity_score: number
  summary: string
  suggested_priority: Priority
  reasoning: string
}

export interface TicketFilters {
  status?: TicketStatus
  priority?: Priority
  category?: TicketCategory
}

export interface CreateTicketInput {
  discord_message_id?: string
  discord_channel_id?: string
  discord_thread_id?: string
  discord_author_id?: string
  discord_author_name?: string
  content: string
  category?: TicketCategory
  severity_score?: number
  ai_summary?: string
  ai_suggested_priority?: Priority
  priority: Priority
  sla_response_deadline?: string
  sla_resolve_deadline?: string
}
