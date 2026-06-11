import { MOCK_EXTERNALS } from '@/lib/mock-mode'
import { getIntegration } from '@/lib/db/queries/integrations'
import { DEFAULT_ORG_ID } from '@/lib/db/schema'

const DISCORD_API = 'https://discord.com/api/v10'

function resolveToken(orgId: number): string | null {
  // Prefer the org's stored bot token; fall back to env var
  const integration = getIntegration(orgId, 'discord')
  return integration?.bot_token ?? process.env.DISCORD_TOKEN ?? null
}

export async function sendToChannel(channelId: string, content: string, orgId = DEFAULT_ORG_ID): Promise<string | null> {
  if (MOCK_EXTERNALS) {
    return `mock-msg-${channelId}`
  }

  const token = resolveToken(orgId)
  if (!token) {
    console.warn('[discord/send] No bot token available — skipping send')
    return null
  }

  const chunks = splitMessage(content)
  let lastMessageId: string | null = null

  for (const chunk of chunks) {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: chunk }),
    })

    if (!res.ok) {
      console.error('[discord/send] Failed to send message:', await res.text())
      return null
    }

    const data = await res.json() as { id: string }
    lastMessageId = data.id
  }

  return lastMessageId
}

export async function sendToThread(threadId: string, content: string, orgId = DEFAULT_ORG_ID): Promise<string | null> {
  return sendToChannel(threadId, content, orgId)
}

function splitMessage(content: string, maxLen = 1990): string[] {
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
