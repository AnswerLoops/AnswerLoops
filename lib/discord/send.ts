const DISCORD_API = 'https://discord.com/api/v10'

export async function sendToChannel(channelId: string, content: string): Promise<string | null> {
  const token = process.env.DISCORD_TOKEN
  if (!token) {
    console.warn('[discord/send] DISCORD_TOKEN not set — skipping send')
    return null
  }

  // Discord messages max 2000 chars — split if needed
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
      const err = await res.text()
      console.error('[discord/send] Failed to send message:', err)
      return null
    }

    const data = await res.json() as { id: string }
    lastMessageId = data.id
  }

  return lastMessageId
}

export async function sendToThread(threadId: string, content: string): Promise<string | null> {
  return sendToChannel(threadId, content)
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
