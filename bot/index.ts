import { Client, GatewayIntentBits, Events, Message, ThreadChannel } from 'discord.js'

const TARGET_URL = process.env.BOT_TARGET_URL ?? 'http://localhost:3000'
const BOT_SECRET = process.env.BOT_SECRET ?? ''
const CHANNEL_IDS = (process.env.DISCORD_CHANNEL_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

if (!process.env.DISCORD_TOKEN) {
  console.error('[bot] DISCORD_TOKEN is not set')
  process.exit(1)
}

if (CHANNEL_IDS.length === 0) {
  console.warn('[bot] DISCORD_CHANNEL_IDS is empty — bot will not forward any messages')
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
})

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] Logged in as ${c.user.tag}`)
  console.log(`[bot] Monitoring ${CHANNEL_IDS.length} channel(s): ${CHANNEL_IDS.join(', ')}`)
  console.log(`[bot] Forwarding to ${TARGET_URL}/api/ingest`)
})

client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages (including our own)
  if (message.author.bot) return

  // Only process messages in monitored channels
  const channelId = message.channelId
  const parentId = message.channel instanceof ThreadChannel ? message.channel.parentId : null

  const isMonitored = CHANNEL_IDS.includes(channelId) || (parentId && CHANNEL_IDS.includes(parentId))
  if (!isMonitored) return

  // Skip very short messages (likely reactions or quick replies)
  if (message.content.trim().length < 10) return

  const isThread = message.channel instanceof ThreadChannel
  const threadId = isThread ? message.channelId : undefined
  const parentChannelId = isThread && message.channel instanceof ThreadChannel
    ? message.channel.parentId ?? channelId
    : channelId

  try {
    const res = await fetch(`${TARGET_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BOT_SECRET}`,
      },
      body: JSON.stringify({
        message_id: message.id,
        content: message.content,
        author_id: message.author.id,
        author_name: message.author.username,
        channel_id: parentChannelId,
        thread_id: threadId,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[bot] Ingest failed (${res.status}):`, text)
      return
    }

    const data = await res.json() as { ok: boolean; ticket_id?: number; duplicate?: boolean }
    if (data.duplicate) {
      console.log(`[bot] Duplicate message ${message.id} — skipped`)
    } else {
      console.log(`[bot] Ticket #${data.ticket_id} created from message ${message.id}`)
    }
  } catch (err) {
    console.error('[bot] Failed to forward message:', err)
  }
})

client.login(process.env.DISCORD_TOKEN)
