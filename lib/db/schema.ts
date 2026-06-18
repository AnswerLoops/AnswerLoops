import {
  pgTable,
  serial,
  integer,
  text,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const now = sql`now()`

export const orgs = pgTable('orgs', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  onboardedAt: text('onboarded_at'),
  widgetToken: text('widget_token').unique(),
  widgetTokenExpiresAt: text('widget_token_expires_at'),
  createdAt: text('created_at').notNull().default(now),
})

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique(),
  name: text('name'),
  image: text('image'),
  provider: text('provider'),
  createdAt: text('created_at').notNull().default(now),
})

export const memberships = pgTable('memberships', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  orgId: integer('org_id').notNull().references(() => orgs.id),
  role: text('role').notNull().default('owner'),
  createdAt: text('created_at').notNull().default(now),
})

export const slaConfigs = pgTable('sla_configs', {
  id: serial('id').primaryKey(),
  priority: text('priority').notNull().unique(),
  responseHours: integer('response_hours').notNull(),
  resolveHours: integer('resolve_hours').notNull(),
  updatedAt: text('updated_at').notNull().default(now),
})

export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
    discordMessageId: text('discord_message_id').unique(),
    discordChannelId: text('discord_channel_id'),
    discordThreadId: text('discord_thread_id'),
    discordAuthorId: text('discord_author_id'),
    discordAuthorName: text('discord_author_name'),
    content: text('content').notNull(),
    category: text('category'),
    severityScore: doublePrecision('severity_score'),
    aiSummary: text('ai_summary'),
    aiSuggestedPriority: text('ai_suggested_priority'),
    aiDraft: text('ai_draft'),
    aiDraftStatus: text('ai_draft_status').notNull().default('pending'),
    aiDraftPostedAt: text('ai_draft_posted_at'),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('open'),
    resolutionNotes: text('resolution_notes'),
    slaResponseDeadline: text('sla_response_deadline'),
    slaResolveDeadline: text('sla_resolve_deadline'),
    slaResponseMet: integer('sla_response_met'),
    slaResolveMet: integer('sla_resolve_met'),
    firstResponseAt: text('first_response_at'),
    resolvedAt: text('resolved_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    index('idx_tickets_status').on(t.status),
    index('idx_tickets_priority').on(t.priority),
    index('idx_tickets_category').on(t.category),
    index('idx_tickets_ai_draft').on(t.aiDraftStatus),
    index('idx_tickets_org').on(t.orgId),
  ]
)

export const ticketReplies = pgTable('ticket_replies', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  staffName: text('staff_name').notNull(),
  content: text('content').notNull(),
  discordMsgId: text('discord_msg_id'),
  createdAt: text('created_at').notNull().default(now),
})

export const ticketEvents = pgTable('ticket_events', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  eventType: text('event_type').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  actor: text('actor'),
  createdAt: text('created_at').notNull().default(now),
})

export const githubRepos = pgTable('github_repos', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  installationId: integer('installation_id').notNull(),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  isPrivate: integer('is_private').notNull().default(0),
  addedAt: text('added_at').notNull().default(now),
})

export const faqSnapshots = pgTable('faq_snapshots', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  weekStart: text('week_start').notNull(),
  weekEnd: text('week_end').notNull(),
  content: text('content').notNull(),
  ticketCount: integer('ticket_count').notNull(),
  generatedAt: text('generated_at').notNull().default(now),
})

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  ticketId: integer('ticket_id').references(() => tickets.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  read: integer('read').notNull().default(0),
  createdAt: text('created_at').notNull().default(now),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull().default(now),
})

export const ticketEmbeddings = pgTable('ticket_embeddings', {
  ticketId: integer('ticket_id').primaryKey().references(() => tickets.id),
  vector: text('vector').notNull(),
  model: text('model').notNull(),
  createdAt: text('created_at').notNull().default(now),
})

export const ticketLinks = pgTable(
  'ticket_links',
  {
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    relatedId: integer('related_id').notNull().references(() => tickets.id),
    score: doublePrecision('score').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.ticketId, t.relatedId] }),
    index('idx_ticket_links_ticket').on(t.ticketId),
  ]
)

export const ticketFeedback = pgTable(
  'ticket_feedback',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    source: text('source').notNull(),
    vote: text('vote').notNull(),
    actor: text('actor').notNull(),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('ticket_feedback_unique').on(t.ticketId, t.source, t.actor),
    index('idx_ticket_feedback_ticket').on(t.ticketId),
  ]
)

export const answerMessages = pgTable('answer_messages', {
  discordMessageId: text('discord_message_id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  createdAt: text('created_at').notNull().default(now),
})

export const aiAssessments = pgTable('ai_assessments', {
  ticketId: integer('ticket_id').primaryKey().references(() => tickets.id),
  confidence: doublePrecision('confidence').notNull(),
  answeredFully: integer('answered_fully').notNull(),
  autoDeflected: integer('auto_deflected').notNull().default(0),
  reasoning: text('reasoning'),
  model: text('model'),
  createdAt: text('created_at').notNull().default(now),
})

export const kbArticles = pgTable(
  'kb_articles',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    embedding: text('embedding').notNull(),
    model: text('model').notNull(),
    sourceTicketId: integer('source_ticket_id').references(() => tickets.id),
    published: integer('published').notNull().default(1),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    index('idx_kb_articles_published').on(t.published),
    index('idx_kb_articles_source').on(t.sourceTicketId),
  ]
)

export const integrations = pgTable(
  'integrations',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    platform: text('platform').notNull(),
    botToken: text('bot_token'),
    botSecret: text('bot_secret').unique(),
    channelIds: text('channel_ids'),
    teamId: text('team_id'),
    webhookSecret: text('webhook_secret'),
    enabled: integer('enabled').notNull().default(1),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('integrations_org_platform').on(t.orgId, t.platform),
    index('idx_integrations_bot_secret').on(t.botSecret),
    index('idx_integrations_org').on(t.orgId),
  ]
)

export const invitations = pgTable(
  'invitations',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    token: text('token').notNull().unique(),
    invitedBy: integer('invited_by').references(() => users.id),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    index('idx_invitations_token').on(t.token),
    index('idx_invitations_org').on(t.orgId),
  ]
)

export const aiConfigs = pgTable('ai_configs', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().unique().references(() => orgs.id),
  chatProvider: text('chat_provider').notNull().default('openai'),
  chatModel: text('chat_model').notNull().default('gpt-4o'),
  chatApiKey: text('chat_api_key'),
  chatBaseUrl: text('chat_base_url'),
  embeddingProvider: text('embedding_provider').notNull().default('openai'),
  embeddingModel: text('embedding_model').notNull().default('text-embedding-3-small'),
  embeddingApiKey: text('embedding_api_key'),
  embeddingBaseUrl: text('embedding_base_url'),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
})

/** The default workspace that owns all data until real auth assigns memberships. */
export const DEFAULT_ORG_ID = 1
