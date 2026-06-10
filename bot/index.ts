import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  Partials,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js'
import {
  forwardMessage,
  forwardReaction,
  type BotConfig,
  type IncomingMessage,
  type IncomingReaction,
} from './handlers'

const config: BotConfig = {
  targetUrl: process.env.BOT_TARGET_URL ?? 'http://localhost:3000',
  botSecret: process.env.BOT_SECRET ?? '',
  channelIds: (process.env.DISCORD_CHANNEL_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
}

if (!process.env.DISCORD_TOKEN) {
  console.error('[bot] DISCORD_TOKEN is not set')
  process.exit(1)
}

if (config.channelIds.length === 0) {
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

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] Logged in as ${c.user.tag}`)
  console.log(`[bot] Monitoring ${config.channelIds.length} channel(s): ${config.channelIds.join(', ')}`)
  console.log(`[bot] Forwarding to ${config.targetUrl}/api/ingest`)
})

client.on(Events.MessageCreate, async (message: Message) => {
  const result = await forwardMessage(message as unknown as IncomingMessage, config)
  if (result.data?.duplicate) {
    console.log(`[bot] Duplicate message ${message.id} — skipped`)
  } else if (result.data?.ticket_id) {
    console.log(`[bot] Ticket #${result.data.ticket_id} created from message ${message.id}`)
  }
})

client.on(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    const result = await forwardReaction(reaction as unknown as IncomingReaction, user, config)
    if (result.data?.ticket_id) {
      console.log(`[bot] Feedback on ticket #${result.data.ticket_id} from ${user.id}`)
    }
  }
)

client.login(process.env.DISCORD_TOKEN)
