import {
  pgTable,
  serial,
  integer,
  smallint,
  text,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
  jsonb,
  timestamp,
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
  roiMinutesPerTicket: integer('roi_minutes_per_ticket'),
  roiStaffHourlyRate: integer('roi_staff_hourly_rate'),
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
    discordGuildId: text('discord_guild_id'),
    discordChannelId: text('discord_channel_id'),
    discordThreadId: text('discord_thread_id'),
    discordAuthorId: text('discord_author_id'),
    discordAuthorName: text('discord_author_name'),
    discordDeletedAt: text('discord_deleted_at'),
    sourcePlatform: text('source_platform').notNull().default('discord'),
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
  monitoredEvents: text('monitored_events').notNull().default('both'),
  kbEnabled: integer('kb_enabled').notNull().default(0),
  kbLastSynced: text('kb_last_synced'),
  kbChunkCount: integer('kb_chunk_count').notNull().default(0),
  addedAt: text('added_at').notNull().default(now),
}, (t) => ({
  ownerRepoUnique: uniqueIndex('github_repos_owner_repo_unique').on(t.owner, t.repo),
}))

// One row per Discord server an org has connected via the OAuth "Add to
// Discord" flow. A guild can only belong to one org (unique on guildId) —
// mirrors githubRepos: a child table keyed by orgId, not unique-per-org,
// since an org can connect any number of servers.
export const discordGuilds = pgTable('discord_guilds', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => orgs.id),
  guildId: text('guild_id').notNull(),
  guildName: text('guild_name'),
  channelIds: text('channel_ids'),
  escalationRoleId: text('escalation_role_id'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
}, (t) => [
  uniqueIndex('discord_guilds_guild_unique').on(t.guildId),
  index('idx_discord_guilds_org').on(t.orgId),
])

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

export const kbSources = pgTable(
  'kb_sources',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    filename: text('filename').notNull(),
    fileType: text('file_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    chunkCount: integer('chunk_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('idx_kb_sources_org').on(t.orgId)]
)

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
    sourceId: integer('source_id'),
    sourcePage: integer('source_page'),
    published: integer('published').notNull().default(1),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    index('idx_kb_articles_published').on(t.published),
    index('idx_kb_articles_source').on(t.sourceTicketId),
    index('idx_kb_articles_source_id').on(t.sourceId),
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
    guildChannelMap: text('guild_channel_map'),
    teamId: text('team_id'),
    webhookSecret: text('webhook_secret'),
    escalationRoleId: text('escalation_role_id'),
    connectedGuildId: text('connected_guild_id'),
    confidenceThreshold: doublePrecision('confidence_threshold').default(0.8),
    // Platform-hosted inbound email address ({slug}-{rand}@inbox domain).
    // Set once at connect-time for the email platform row; immutable after.
    inboundAddress: text('inbound_address').unique(),
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

// Raw-inbound persistence + idempotency + conversation-threading spine for the
// email channel. rfc_message_id is the RFC 5322 Message-ID header — NOT the
// provider's API id — because that's what a customer's reply carries in its
// In-Reply-To/References headers; storing both directions here is what lets a
// reply to an AI answer land on the same ticket instead of spawning a new one.
export const emailMessages = pgTable(
  'email_messages',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    direction: text('direction').notNull(), // 'in' | 'out'
    rfcMessageId: text('rfc_message_id').notNull().unique(),
    // Resend's own internal id for outbound sends — delivery-status webhooks
    // (bounced/complained/delivery_delayed) reference this, not our RFC id.
    providerMessageId: text('provider_message_id').unique(),
    inReplyTo: text('in_reply_to'),
    references: text('references'),
    ticketId: integer('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
    fromAddr: text('from_addr'),
    toAddr: text('to_addr'),
    subject: text('subject'),
    spamVerdict: text('spam_verdict'),
    // 'received' | 'processed' | 'rejected_spam' | 'rejected_loop' |
    // 'rejected_filter' | 'sent' | 'bounced' | 'delivery_failed'
    status: text('status').notNull().default('received'),
    rawPayload: jsonb('raw_payload'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    index('idx_email_messages_org').on(t.orgId),
    index('idx_email_messages_ticket').on(t.ticketId),
    index('idx_email_messages_in_reply_to').on(t.inReplyTo),
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

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().unique().references(() => orgs.id),
  planId: text('plan_id').notNull().default('hobby'),
  status: text('status').notNull().default('active'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end').notNull().default(0),
  trialEndsAt: text('trial_ends_at'),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
})

export const widgetLeads = pgTable(
  'widget_leads',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    widgetToken: text('widget_token').notNull(),
    email: text('email').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    index('idx_widget_leads_org').on(t.orgId),
    index('idx_widget_leads_email').on(t.email),
  ]
)

export const csatMessages = pgTable('csat_messages', {
  messageId: text('message_id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id),
  createdAt: text('created_at').notNull().default(now),
})

export const csatRatings = pgTable(
  'csat_ratings',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id').notNull().references(() => tickets.id),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    rating: smallint('rating').notNull(),
    platform: text('platform').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    index('idx_csat_ratings_org').on(t.orgId),
    index('idx_csat_ratings_ticket').on(t.ticketId),
  ]
)

export const waitlist = pgTable('waitlist', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`now()`),
})

// Agent/MCP API keys. Only the SHA-256 hash is stored — the plaintext key is
// shown once at creation time and is not recoverable, same UX precedent as
// the email integration's one-time webhook secret display.
export const apiKeys = pgTable(
  'api_keys',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull().default(now),
    lastUsedAt: text('last_used_at'),
    expiresAt: text('expires_at'),
    revokedAt: text('revoked_at'),
  },
  (t) => [
    index('idx_api_keys_org').on(t.orgId),
  ]
)

// One row per generate_answer MCP call. Unlike every other channel, this call
// never creates a ticket/ai_assessments row — without a table of its own,
// the org's monthly deflection usage would never reflect API-originated LLM
// spend. highConfidence mirrors ai_assessments.autoDeflected semantics: only
// high-confidence generations count against the plan's deflection limit,
// same as an auto-answered ticket.
export const apiGenerations = pgTable(
  'api_generations',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => orgs.id),
    highConfidence: integer('high_confidence').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    index('idx_api_generations_org').on(t.orgId),
  ]
)

// Shared, cross-instance rate-limit counter (#169). lib/ratelimit.ts's
// original in-process Map only sees the traffic hitting one instance, so
// this table backs a Postgres-atomic-upsert limiter that every instance
// shares — see rateLimitShared in lib/ratelimit.ts.
export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(1),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
})

/** The default workspace that owns all data until real auth assigns memberships. */
export const DEFAULT_ORG_ID = 1
