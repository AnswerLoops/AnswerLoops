import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// The 1-click Discord OAuth onboarding path previously skipped channel
// selection entirely: the bot joined the server, but bot/handlers.ts only
// forwards messages whose channel is in the integration's channel_ids list
// (see isMonitored/shouldForward), and the OAuth callback never set that
// list. The onboarding wizard's discord_connected=1 handler then jumped
// straight past the Connect step to Seed KB, so a new user finished
// onboarding believing Discord was live while every message the bot saw was
// silently dropped — the only signal was a server-side log line
// ("No channel IDs configured") nobody sees.
//
// Fix: the callback now passes guild_id back to the onboarding redirect, and
// the wizard renders the same channel picker Settings already uses (fetching
// channels for that guild via GET /api/discord/guilds?guild_id=, which uses
// the platform bot token — no per-org token needed) before letting the user
// continue.
//
// Source-file structural assertions — same convention as
// infra-discord-oauth.test.ts (Next.js route modules can't be imported here).

const ROOT = process.cwd()

function read(relPath: string): string {
  const absPath = path.join(ROOT, relPath)
  expect(fs.existsSync(absPath), `File not found: ${relPath}`).toBe(true)
  return fs.readFileSync(absPath, 'utf-8')
}

describe('Discord OAuth callback passes guild_id back to onboarding', () => {
  it('the onboarding redirect includes guild_id, not just discord_connected', () => {
    const src = read('app/api/discord/callback/route.ts')
    const onboardingBlock = src.slice(src.indexOf("if (from === 'onboarding') {"))
    expect(onboardingBlock).toContain("next.searchParams.set('discord_connected', '1')")
    expect(onboardingBlock.slice(0, 200)).toContain("next.searchParams.set('guild_id', guildId)")
  })
})

describe('onboarding wizard routes 1-click Discord connects to the channel picker', () => {
  it('no longer marks connect done and jumps straight to seed on discord_connected=1', () => {
    const src = read('app/onboarding/wizard.tsx')
    // The old bug: 'connect' was added to completed and step jumped to 'seed'
    // in the same effect that reads discord_connected, with no channel step.
    const effectBody = src.slice(
      src.indexOf("discord_connected") ,
      src.indexOf('}, [searchParams])')
    )
    expect(effectBody).not.toMatch(/new Set\(\[\.\.\.prev, 'name', 'connect'\]\)/)
    expect(effectBody).not.toContain("setStep('seed')")
    expect(effectBody).toContain("setStep('connect')")
  })

  it('captures guild_id from the callback redirect into state', () => {
    const src = read('app/onboarding/wizard.tsx')
    expect(src).toContain('discordOAuthGuildId')
    expect(src).toContain("searchParams.get('guild_id')")
  })

  it('DiscordFlow fetches channels for the OAuth guild via the platform-bot-token endpoint', () => {
    const src = read('app/onboarding/wizard.tsx')
    expect(src).toContain('oauthGuildId')
    expect(src).toContain('/api/discord/guilds?guild_id=${oauthGuildId}')
  })

  it('lands directly on the channels sub-step when returning from OAuth, skipping choose/invite', () => {
    const src = read('app/onboarding/wizard.tsx')
    expect(src).toContain("useState<DiscordSubStep>(oauthGuildId ? 'channels' : 'choose')")
  })

  it('tells the user explicitly that nothing is monitored until they pick a channel', () => {
    const src = read('app/onboarding/wizard.tsx')
    expect(src).toMatch(/won.t send any messages here until you select at least one channel/)
  })

  it('ConnectStep defaults straight into the Discord flow when oauthGuildId is present, skipping the platform picker', () => {
    const src = read('app/onboarding/wizard.tsx')
    expect(src).toContain("useState<Platform>(oauthGuildId ? 'discord' : null)")
  })
})
