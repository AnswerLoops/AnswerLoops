import { sql } from 'drizzle-orm'
import { getDb } from '../db/drizzle'
import { processCommunityMessage } from '../ingest/pipeline'
import { getIntegration, parseChannelIds } from '../db/queries/integrations'
import { logger } from '../logger'

const MOD = 'slack-poller'

const DEFAULT_INTERVAL_MS = parseInt(process.env.SLACK_POLL_INTERVAL_SECONDS ?? '60', 10) * 1000

interface SlackMessage {
  ts: string
  text?: string
  user?: string
  bot_id?: string
  subtype?: string
  thread_ts?: string
}

async function getCursor(orgId: number, channelId: string): Promise<string> {
  const db = getDb()
  const rows = await db.execute(
    sql`SELECT last_ts FROM slack_poll_cursors WHERE org_id = ${orgId} AND channel_id = ${channelId}`
  ) as unknown as { last_ts: string }[]
  return rows[0]?.last_ts ?? '0'
}

async function setCursor(orgId: number, channelId: string, ts: string): Promise<void> {
  const db = getDb()
  await db.execute(sql`
    INSERT INTO slack_poll_cursors (org_id, channel_id, last_ts, updated_at)
    VALUES (${orgId}, ${channelId}, ${ts}, now())
    ON CONFLICT (org_id, channel_id) DO UPDATE
      SET last_ts = EXCLUDED.last_ts, updated_at = now()
  `)
}

async function pollChannel(orgId: number, channelId: string, botToken: string): Promise<void> {
  const oldest = await getCursor(orgId, channelId)

  const url = new URL('https://slack.com/api/conversations.history')
  url.searchParams.set('channel', channelId)
  url.searchParams.set('limit', '100')
  // oldest is exclusive — only fetch messages newer than the cursor
  if (oldest !== '0') url.searchParams.set('oldest', oldest)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${botToken}` },
  })
  const data = await res.json() as { ok: boolean; messages?: SlackMessage[]; error?: string }

  if (!data.ok) {
    logger.warn('Slack conversations.history failed', { module: MOD, channelId, error: data.error })
    return
  }

  const messages = (data.messages ?? [])
    .filter((m) => !m.bot_id && !m.subtype && m.user && (m.text?.trim().length ?? 0) >= 10)
    // Slack returns newest-first; process oldest-first so cursor advances correctly
    .reverse()

  for (const msg of messages) {
    try {
      await processCommunityMessage(
        {
          messageId: msg.ts,
          content: msg.text!.trim(),
          authorId: msg.user!,
          authorName: msg.user!,
          channelId,
          threadId: msg.thread_ts,
          platform: 'slack',
        },
        orgId
      )
    } catch (err) {
      logger.warn('failed to process polled Slack message', { module: MOD, ts: msg.ts, error: err })
    }
  }

  // Advance cursor to the newest message we saw
  if (messages.length > 0) {
    const newestTs = messages[messages.length - 1].ts
    await setCursor(orgId, channelId, newestTs)
    logger.info('Slack poll complete', { module: MOD, orgId, channelId, newMessages: messages.length })
  }
}

async function pollOrg(orgId: number): Promise<void> {
  const integration = await getIntegration(orgId, 'slack').catch(() => null)
  if (!integration?.bot_token || integration.enabled !== 1) return

  const channelIds = parseChannelIds(integration)
  if (channelIds.length === 0) return

  await Promise.allSettled(
    channelIds.map((id) => pollChannel(orgId, id, integration.bot_token!))
  )
}

// Active org IDs to poll. Updated when config_changed fires.
let activeOrgIds: number[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let running = false

async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    await Promise.allSettled(activeOrgIds.map(pollOrg))
  } finally {
    running = false
  }
}

function schedule(): void {
  timer = setTimeout(async () => {
    await tick().catch((err) => logger.warn('slack poll tick error', { module: MOD, error: err }))
    schedule()
  }, DEFAULT_INTERVAL_MS)
}

export function startSlackPoller(orgIds: number[]): void {
  activeOrgIds = orgIds
  if (timer !== null) return   // already running — just updated the org list
  logger.info('Slack poller started', { module: MOD, intervalMs: DEFAULT_INTERVAL_MS, orgs: orgIds })
  // Run immediately on first start, then on interval
  tick()
    .catch((err) => logger.warn('slack poll initial tick error', { module: MOD, error: err }))
    .finally(schedule)
}

export function reloadSlackPoller(orgIds: number[]): void {
  activeOrgIds = orgIds
  logger.info('Slack poller org list updated', { module: MOD, orgs: orgIds })
}

export function stopSlackPoller(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  logger.info('Slack poller stopped', { module: MOD })
}
