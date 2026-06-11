import { sqliteTable, integer, text, real, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const now = sql`(datetime('now'))`

export const orgs = sqliteTable('orgs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  createdAt: text('created_at').notNull().default(now),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique(),
  name: text('name'),
  image: text('image'),
  provider: text('provider'),
  createdAt: text('created_at').notNull().default(now),
})

export const memberships = sqliteTable('memberships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  orgId: integer('org_id').notNull().references(() => orgs.id),
  role: text('role').notNull().default('owner'),
  createdAt: text('created_at').notNull().default(now),
})

export const slaConfigs = sqliteTable('sla_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  priority: text('priority').notNull().unique(),
  responseHours: integer('response_hours').notNull(),
  resolveHours: integer('resolve_hours').notNull(),
  updatedAt: text('updated_at').notNull().default(now),
})

export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  discordMessageId: text('discord_message_id').unique(),
  discordChannelId: text('discord_channel_id'),
  discordThreadId: text('discord_thread_id'),
  discordAuthorId: text('discord_author_id'),
  discordAuthorName: text('discord_author_name'),
  content: text('content').notNull(),
  category: text('category'),
  severityScore: real('severity_score'),
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
})

export const ticketReplies = sqliteTable('ticket_replies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  staffName: text('staff_name').notNull(),
  content: text('content').notNull(),
  discordMsgId: text('discord_msg_id'),
  createdAt: text('created_at').notNull().default(now),
})

export const ticketEvents = sqliteTable('ticket_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  eventType: text('event_type').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  actor: text('actor'),
  createdAt: text('created_at').notNull().default(now),
})

export const githubRepos = sqliteTable('github_repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  installationId: integer('installation_id').notNull(),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  isPrivate: integer('is_private').notNull().default(0),
  addedAt: text('added_at').notNull().default(now),
})

export const faqSnapshots = sqliteTable('faq_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  weekStart: text('week_start').notNull(),
  weekEnd: text('week_end').notNull(),
  content: text('content').notNull(),
  ticketCount: integer('ticket_count').notNull(),
  generatedAt: text('generated_at').notNull().default(now),
})

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  ticketId: integer('ticket_id').references(() => tickets.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  read: integer('read').notNull().default(0),
  createdAt: text('created_at').notNull().default(now),
})

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').notNull().default(now),
})

export const ticketEmbeddings = sqliteTable('ticket_embeddings', {
  ticketId: integer('ticket_id').primaryKey().references(() => tickets.id),
  vector: text('vector').notNull(),
  model: text('model').notNull(),
  createdAt: text('created_at').notNull().default(now),
})

export const ticketLinks = sqliteTable(
  'ticket_links',
  {
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    relatedId: integer('related_id').notNull().references(() => tickets.id),
    score: real('score').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.relatedId] })]
)

export const ticketFeedback = sqliteTable('ticket_feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  source: text('source').notNull(),
  vote: text('vote').notNull(),
  actor: text('actor').notNull(),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
})

export const answerMessages = sqliteTable('answer_messages', {
  discordMessageId: text('discord_message_id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  createdAt: text('created_at').notNull().default(now),
})

export const aiAssessments = sqliteTable('ai_assessments', {
  ticketId: integer('ticket_id').primaryKey().references(() => tickets.id),
  confidence: real('confidence').notNull(),
  answeredFully: integer('answered_fully').notNull(),
  autoDeflected: integer('auto_deflected').notNull().default(0),
  reasoning: text('reasoning'),
  model: text('model'),
  createdAt: text('created_at').notNull().default(now),
})

export const kbArticles = sqliteTable('kb_articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orgId: integer('org_id').notNull().default(1).references(() => orgs.id),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  embedding: text('embedding').notNull(),
  model: text('model').notNull(),
  sourceTicketId: integer('source_ticket_id').references(() => tickets.id),
  published: integer('published').notNull().default(1),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
})

export const integrations = sqliteTable('integrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
})

/** The default workspace that owns all data until real auth assigns memberships. */
export const DEFAULT_ORG_ID = 1
