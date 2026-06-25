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
import { getIntegration, parseChannelIds } from '../lib/db/queries/integrations'
import { DEFAULT_ORG_ID } from '../lib/db/schema'

const MOD = 'bot'

async function loadConfig(): Promise<{
  discordToken: string
  config: BotConfig
  slashConfig: SlashConfig
}> {
  const targetUrl = process.env.BOT_TARGET_URL ?? 'http://localhost:3000'

  // Prefer DB config (set via Settings UI) over env vars
  const dbIntegration = await getIntegration(DEFAULT_ORG_ID, 'discord').catch(() => null)

  const discordToken =
    (dbIntegration?.bot_token ?? process.env.DISCORD_TOKEN) || ''

  const botSecret =
    (dbIntegration?.bot_secret ?? process.env.BOT_SECRET) || ''

  const channelIds = dbIntegration
    ? parseChannelIds(dbIntegration)
    : (process.env.DISCORD_CHANNEL_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  if (dbIntegration) {
    logger.info('loaded Discord config from database', { module: MOD, channelCount: channelIds.length })
  } else {
    logger.info('loaded Discord config from environment variables', { module: MOD, channelCount: channelIds.length })
  }

  return {
    discordToken,
    config: { targetUrl, botSecret, channelIds },
    slashConfig: { targetUrl, botSecret },
  }
}

const { discordToken, config, slashConfig } = await loadConfig()

if (!discordToken) {
  logger.error('No Discord token found — set it in Settings → Integrations or DISCORD_TOKEN env var', { module: MOD })
  process.exit(1)
}

if (!process.env.DISCORD_APPLICATION_ID) {
  logger.warn('DISCORD_APPLICATION_ID not set — slash commands will not be registered', { module: MOD })
}

if (config.channelIds.length === 0) {
  logger.warn('No channel IDs configured — bot will not forward any messages. Set them in Settings → Integrations.', { module: MOD })
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
      discordToken,
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

client.login(discordToken)
