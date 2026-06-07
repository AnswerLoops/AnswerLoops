import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  ThreadChannel,
  Partials,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js'

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
  // Reactions arrive on messages the bot didn't cache (e.g. an AI answer posted
  // via the REST API), so we must opt into partials to receive those events.
  partials: [Partials.Message, Partials.Reaction],
})

// 👍/👎 emojis the bot treats as feedback votes on an AI answer.
const VOTE_EMOJI: Record<string, 'up' | 'down'> = {
  '👍': 'up',
  '👎': 'down',
}

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

client.on(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return

    const vote = VOTE_EMOJI[reaction.emoji.name ?? '']
    if (!vote) return

    // Partial reactions need a fetch to expose the message id.
    if (reaction.partial) {
      try {
        await reaction.fetch()
      } catch (err) {
        console.error('[bot] Failed to fetch reaction:', err)
        return
      }
    }

    try {
      const res = await fetch(`${TARGET_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${BOT_SECRET}`,
        },
        body: JSON.stringify({
          message_id: reaction.message.id,
          vote,
          actor: user.id,
        }),
      })

      if (!res.ok) {
        console.error(`[bot] Feedback failed (${res.status}):`, await res.text())
        return
      }

      const data = (await res.json()) as { ok: boolean; ticket_id?: number; ignored?: boolean }
      if (data.ticket_id) {
        console.log(`[bot] Feedback ${vote} on ticket #${data.ticket_id} from ${user.id}`)
      }
    } catch (err) {
      console.error('[bot] Failed to forward reaction:', err)
    }
  }
)

client.login(process.env.DISCORD_TOKEN)
