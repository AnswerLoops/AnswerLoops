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
  ChatInputCommandInteraction,
} from 'discord.js'
import {
  forwardMessage,
  forwardReaction,
  type BotConfig,
  type IncomingMessage,
  type IncomingReaction,
} from './handlers'
import { registerSlashCommands, handleAsk, handleSummarize, type SlashConfig } from './slash'
import { logger } from '../lib/logger'

const MOD = 'bot'

const config: BotConfig = {
  targetUrl: process.env.BOT_TARGET_URL ?? 'http://localhost:3000',
  botSecret: process.env.BOT_SECRET ?? '',
  channelIds: (process.env.DISCORD_CHANNEL_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
}

const slashConfig: SlashConfig = {
  targetUrl: config.targetUrl,
  botSecret: config.botSecret,
}

if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN is not set', { module: MOD })
  process.exit(1)
}

if (!process.env.DISCORD_APPLICATION_ID) {
  logger.warn('DISCORD_APPLICATION_ID not set — slash commands will not be registered', { module: MOD })
}

if (config.channelIds.length === 0) {
  logger.warn('DISCORD_CHANNEL_IDS is empty — bot will not forward any messages', { module: MOD })
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

client.once(Events.ClientReady, async (c) => {
  logger.info(`logged in as ${c.user.tag}`, {
    module: MOD,
    channelCount: config.channelIds.length,
    targetUrl: config.targetUrl,
  })

  const applicationId = process.env.DISCORD_APPLICATION_ID
  if (applicationId) {
    await registerSlashCommands(
      process.env.DISCORD_TOKEN!,
      applicationId,
      process.env.DISCORD_GUILD_ID // set for instant guild-scoped commands; omit for global
    )
  }
})

client.on(Events.MessageCreate, async (message: Message) => {
  const result = await forwardMessage(message as unknown as IncomingMessage, config)
  if (result.data?.duplicate) {
    logger.debug('duplicate message skipped', { module: MOD, messageId: message.id })
  } else if (result.data?.ticket_id) {
    logger.info('ticket created', { module: MOD, ticketId: result.data.ticket_id, messageId: message.id })
  }
})

client.on(
  Events.MessageReactionAdd,
  async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    const result = await forwardReaction(reaction as unknown as IncomingReaction, user, config)
    if (result.data?.ticket_id) {
      logger.info('feedback recorded', { module: MOD, ticketId: result.data.ticket_id, userId: user.id })
    }
  }
)

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return
  const cmd = interaction as ChatInputCommandInteraction

  logger.info('slash command received', { module: MOD, command: cmd.commandName, userId: cmd.user.id })

  if (cmd.commandName === 'ask') {
    await handleAsk(cmd, slashConfig)
  } else if (cmd.commandName === 'summarize') {
    await handleSummarize(cmd, slashConfig)
  }
})

client.login(process.env.DISCORD_TOKEN)
