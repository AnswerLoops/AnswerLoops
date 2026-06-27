import postgres from 'postgres'
import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  Partials,
  MessageReaction,
  PartialMessageReaction,
  PartialMessage,
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
import { getIntegration, getIntegrationByGuildId, parseChannelIds, saveGuildChannelMap } from '../lib/db/queries/integrations'
import { markDiscordDeleted, markThreadDiscordDeleted } from '../lib/db/queries/tickets'
import { DEFAULT_ORG_ID } from '../lib/db/schema'

const MOD = 'bot'

/**
 * Opens a dedicated single connection for LISTEN/NOTIFY.
 * Pooled connections cannot be used for LISTEN — the notification arrives on
 * whichever connection Postgres chooses, so we need one stable connection.
 * Returns a cleanup function that closes the connection on shutdown.
 */
function watchConfigChanges(onNotify: () => Promise<void>): () => Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    logger.warn('DATABASE_URL not set — config hot-reload disabled', { module: MOD })
    return () => Promise.resolve()
  }

  const listener = postgres(url, { max: 1 })

  listener
    .listen('config_changed', async () => {
      logger.info('config_changed notification — reloading', { module: MOD })
      await onNotify().catch((err) =>
        logger.warn('config reload failed after notify', { module: MOD, error: err })
      )
    })
    .catch((err) => logger.warn('LISTEN setup failed', { module: MOD, error: err }))

  logger.info('LISTEN config_changed active', { module: MOD })
  return () => listener.end()
}

/** Builds { channelId → guildId } from all guilds the bot is currently in. */
function buildGuildChannelMap(guilds: Map<string, { channels: { cache: Map<string, unknown> } }>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [guildId, guild] of guilds) {
    for (const channelId of guild.channels.cache.keys()) {
      map[channelId] = guildId
    }
  }
  return map
}

// Per-guild config cache for multi-tenant routing.
// Maps guildId → per-org BotConfig (or null if no org has that guild connected).
// Cleared whenever a config_changed LISTEN/NOTIFY fires so fresh DB values are
// picked up without a bot restart.
const guildConfigCache = new Map<string, { config: BotConfig; orgId: number } | null>()

function clearGuildConfigCache() {
  guildConfigCache.clear()
  logger.info('per-guild config cache cleared', { module: MOD })
}

/** Resolve per-org config for a specific guildId. Falls back to null if unconfigured. */
async function loadOrgConfigForGuild(guildId: string): Promise<{ config: BotConfig; orgId: number } | null> {
  if (guildConfigCache.has(guildId)) return guildConfigCache.get(guildId)!

  const targetUrl = process.env.BOT_TARGET_URL ?? 'http://localhost:3000'
  const integration = await getIntegrationByGuildId(guildId).catch(() => null)

  let result: { config: BotConfig; orgId: number } | null = null
  if (integration) {
    result = {
      orgId: integration.org_id,
      config: {
        targetUrl,
        botSecret: integration.bot_secret ?? process.env.BOT_SECRET ?? '',
        channelIds: parseChannelIds(integration),
      },
    }
  }

  guildConfigCache.set(guildId, result)
  return result
}

async function loadConfig(): Promise<{
  discordToken: string
  config: BotConfig
  slashConfig: SlashConfig
}> {
  const targetUrl = process.env.BOT_TARGET_URL ?? 'http://localhost:3000'
  const dbIntegration = await getIntegration(DEFAULT_ORG_ID, 'discord').catch(() => null)

  const discordToken = (dbIntegration?.bot_token ?? process.env.DISCORD_TOKEN) || ''
  const botSecret = (dbIntegration?.bot_secret ?? process.env.BOT_SECRET) || ''
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

async function main() {
  const initial = await loadConfig()

  if (!initial.discordToken) {
    logger.error('No Discord token found — set it in Settings → Integrations or DISCORD_TOKEN env var', { module: MOD })
    process.exit(1)
  }

  if (!process.env.DISCORD_APPLICATION_ID) {
    logger.warn('DISCORD_APPLICATION_ID not set — slash commands will not be registered', { module: MOD })
  }

  if (initial.config.channelIds.length === 0) {
    logger.warn('No channel IDs configured — bot will not forward any messages. Set them in Settings → Integrations.', { module: MOD })
  }

  // Mutable ref — event handlers read from this on every invocation so
  // config changes (channels, thresholds, bot secret) apply without restart.
  // The Discord token cannot be hot-swapped (already logged in); a token
  // change requires a bot restart.
  const live = {
    config: initial.config,
    slashConfig: initial.slashConfig,
  }

  // client is declared below — capture via closure after it's assigned
  let clientRef: Client | null = null

  async function reloadConfig() {
    const fresh = await loadConfig().catch(() => null)
    if (!fresh) return
    const prev = live.config.channelIds.join(',')
    const next = fresh.config.channelIds.join(',')
    live.config = fresh.config
    live.slashConfig = fresh.slashConfig
    // Invalidate per-guild cache so new channel/secret values are used immediately.
    clearGuildConfigCache()
    if (prev !== next) {
      logger.info('config reloaded — channel list changed', {
        module: MOD,
        channelCount: fresh.config.channelIds.length,
      })
    }
  }

  async function refreshGuildMap() {
    if (!clientRef?.isReady()) return
    const guildMap = buildGuildChannelMap(
      clientRef.guilds.cache as unknown as Map<string, { channels: { cache: Map<string, unknown> } }>
    )
    await saveGuildChannelMap(DEFAULT_ORG_ID, guildMap).catch(() => null)
  }

  // Replace polling with Postgres LISTEN/NOTIFY — fires instantly when
  // the integrations table is written from the settings UI.
  const stopListening = watchConfigChanges(async () => {
    await reloadConfig()
    await refreshGuildMap()
  })

  // Graceful shutdown
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, async () => {
      await stopListening()
      process.exit(0)
    })
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
  clientRef = client

  client.once(Events.ClientReady, async (c) => {
    logger.info(`logged in as ${c.user.tag}`, {
      module: MOD,
      channelCount: live.config.channelIds.length,
      targetUrl: live.config.targetUrl,
    })

    const applicationId = process.env.DISCORD_APPLICATION_ID
    if (applicationId) {
      await registerSlashCommands(
        initial.discordToken,
        applicationId,
        process.env.DISCORD_GUILD_ID
      )
    }

    // Auto-discover which guild owns each channel so source links work
    // for old tickets (before per-message guild_id capture was added).
    const guildMap = buildGuildChannelMap(c.guilds.cache as unknown as Map<string, { channels: { cache: Map<string, unknown> } }>)
    await saveGuildChannelMap(DEFAULT_ORG_ID, guildMap).catch((err) =>
      logger.warn('failed to save guild channel map', { module: MOD, error: err })
    )
    logger.info('guild channel map saved', { module: MOD, guildCount: c.guilds.cache.size })
  })

  client.on(Events.MessageCreate, async (message: Message) => {
    // Multi-tenant: look up per-org config by guild. Falls back to live.config
    // for single-org (env-var) deployments where no org has a connected guild.
    const orgCfg = message.guildId
      ? await loadOrgConfigForGuild(message.guildId).catch(() => null)
      : null
    const cfg = orgCfg?.config ?? live.config
    const result = await forwardMessage(message as unknown as IncomingMessage, cfg)
    if (result.data?.duplicate) {
      logger.debug('duplicate message skipped', { module: MOD, messageId: message.id })
    } else if (result.data?.ticket_id) {
      logger.info('ticket created', {
        module: MOD,
        ticketId: result.data.ticket_id,
        messageId: message.id,
        orgId: orgCfg?.orgId,
      })
    }
  })

  client.on(
    Events.MessageReactionAdd,
    async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
      const guildId = (reaction.message as { guildId?: string | null }).guildId ?? null
      const orgCfg = guildId
        ? await loadOrgConfigForGuild(guildId).catch(() => null)
        : null
      const cfg = orgCfg?.config ?? live.config
      const result = await forwardReaction(reaction as unknown as IncomingReaction, user, cfg)
      if (result.data?.ticket_id) {
        logger.info('feedback recorded', { module: MOD, ticketId: result.data.ticket_id, userId: user.id })
      }
    }
  )

  // Keep guild→channel map current when bot joins or leaves a server.
  client.on(Events.GuildCreate, async () => {
    await refreshGuildMap()
    logger.info('joined new guild — guild channel map updated', { module: MOD })
  })

  client.on(Events.GuildDelete, async () => {
    await refreshGuildMap()
    logger.info('left guild — guild channel map updated', { module: MOD })
  })

  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    if (!message.id) return
    await markDiscordDeleted(message.id).catch((err) =>
      logger.warn('failed to mark message deleted', { module: MOD, messageId: message.id, error: err })
    )
    logger.info('discord message deleted — ticket source marked', { module: MOD, messageId: message.id })
  })

  client.on(Events.ThreadDelete, async (thread) => {
    await markThreadDiscordDeleted(thread.id).catch((err) =>
      logger.warn('failed to mark thread deleted', { module: MOD, threadId: thread.id, error: err })
    )
    logger.info('discord thread deleted — ticket source marked', { module: MOD, threadId: thread.id })
  })

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    const cmd = interaction as ChatInputCommandInteraction

    logger.info('slash command received', { module: MOD, command: cmd.commandName, userId: cmd.user.id })

    if (cmd.commandName === 'ask') {
      await handleAsk(cmd, live.slashConfig)
    } else if (cmd.commandName === 'summarize') {
      await handleSummarize(cmd, live.slashConfig)
    }
  })

  client.login(initial.discordToken)
}

main().catch((err) => {
  logger.error('bot failed to start', { module: MOD, error: err })
  process.exit(1)
})
