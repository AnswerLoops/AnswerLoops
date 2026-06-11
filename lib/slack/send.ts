import { MOCK_EXTERNALS } from '@/lib/mock-mode'
import { getIntegration } from '@/lib/db/queries/integrations'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const SLACK_API = 'https://slack.com/api'

function resolveToken(orgId: number): string | null {
  const integration = getIntegration(orgId, 'slack')
  return integration?.bot_token ?? null
}

/**
 * Post a message to a Slack channel. Returns the Slack message ts on success
 * (used as a message ID for feedback attribution), or null on failure.
 */
export async function sendToSlackChannel(
  channelId: string,
  content: string,
  orgId = DEFAULT_ORG_ID
): Promise<string | null> {
  if (MOCK_EXTERNALS) {
    return `mock-slack-${channelId}`
  }

  const token = resolveToken(orgId)
  if (!token) {
    console.warn('[slack/send] No bot token for org', orgId, '— skipping send')
    return null
  }

  // Slack messages max 3000 chars per block — split if needed
  const chunks = splitMessage(content)
  let lastTs: string | null = null

  for (const text of chunks) {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: channelId, text }),
    })

    const data = await res.json() as { ok: boolean; ts?: string; error?: string }
    if (!data.ok) {
      console.error('[slack/send] chat.postMessage failed:', data.error)
      return null
    }
    lastTs = data.ts ?? null
  }

  return lastTs
}

function splitMessage(content: string, maxLen = 2990): string[] {
  if (content.length <= maxLen) return [content]
  const chunks: string[] = []
  let remaining = content
  while (remaining.length > maxLen) {
    const splitAt = remaining.lastIndexOf('\n', maxLen) || maxLen
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt)
  }
  if (remaining) chunks.push(remaining)
  return chunks
}
