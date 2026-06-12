'use client'

import { useActionState } from 'react'
import { useState, useEffect } from 'react'
import { updateSLAAction } from '@/app/actions/sla'
import { addRepoAction, removeRepoAction } from '@/app/actions/github'
import { saveDiscordIntegrationAction, deleteDiscordIntegrationAction, saveSlackIntegrationAction, deleteSlackIntegrationAction } from '@/app/actions/integrations'
import { sendInviteAction, revokeInviteAction, removeMemberAction } from '@/app/actions/invitations'
import { Button } from '@/components/ui/button'
import type { SLAConfig, GitHubRepo } from '@/types'

interface Member {
  membership_id: number
  user_id: number
  role: string
  joined_at: string
  email: string | null
  name: string | null
}

interface PendingInvite {
  id: number
  email: string
  role: string
  expires_at: string
  token: string
}

interface DiscordIntegration {
  id: number
  platform: string
  bot_secret: string | null
  channel_ids: string[]
  enabled: number
}

interface SlackIntegration {
  id: number
  platform: string
  team_id: string | null
  channel_ids: string[]
  enabled: number
}

function SLARow({ config }: { config: SLAConfig }) {
  const [state, formAction, isPending] = useActionState(updateSLAAction, null)

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium capitalize text-gray-800">{config.priority}</td>
      <form action={formAction} className="contents">
        <input type="hidden" name="priority" value={config.priority} />
        <td className="px-4 py-3">
          <input type="number" name="responseHours" defaultValue={config.response_hours} min={1}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-center" />
        </td>
        <td className="px-4 py-3">
          <input type="number" name="resolveHours" defaultValue={config.resolve_hours} min={1}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-center" />
        </td>
        <td className="px-4 py-3">
          <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {state?.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
        </td>
      </form>
    </tr>
  )
}

function RepoRow({ repo, onRemoved }: { repo: GitHubRepo; onRemoved: () => void }) {
  const [state, formAction, isPending] = useActionState(removeRepoAction, null)

  return (
    <tr>
      <td className="px-4 py-3 text-sm text-gray-800 font-mono">{repo.owner}/{repo.repo}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{repo.is_private ? 'Private' : 'Public'}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{new Date(repo.added_at).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <form action={async (fd) => { await formAction(fd); onRemoved() }}>
          <input type="hidden" name="id" value={repo.id} />
          <Button type="submit" size="sm" variant="danger" disabled={isPending}>Remove</Button>
        </form>
      </td>
    </tr>
  )
}

function DiscordIntegrationCard() {
  const [integration, setIntegration] = useState<DiscordIntegration | null | undefined>(undefined)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveDiscordIntegrationAction(prev, fd)
      if (result?.botSecret) setNewSecret(result.botSecret)
      if (!result?.error) {
        const updated = await fetch('/api/integrations').then((r) => r.json())
        setIntegration(updated.find((i: DiscordIntegration) => i.platform === 'discord') ?? null)
      }
      return result
    },
    null
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await deleteDiscordIntegrationAction(prev, fd)
      if (!result?.error) setIntegration(null)
      return result
    },
    null
  )

  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((data: DiscordIntegration[]) => {
        setIntegration(data.find((i) => i.platform === 'discord') ?? null)
      })
  }, [])

  if (integration === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const connected = integration !== null && integration.enabled === 1

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold">D</div>
          <div>
            <p className="text-sm font-medium text-gray-900">Discord</p>
            <p className="text-xs text-gray-500">
              {connected
                ? `Connected · ${integration.channel_ids.length} channel(s)`
                : 'Not connected'}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {connected ? 'Active' : 'Inactive'}
        </span>
      </div>

      {newSecret && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">Your BOT_SECRET — copy it now, it won't be shown again:</p>
          <code className="text-xs text-amber-900 break-all font-mono">{newSecret}</code>
          <p className="text-xs text-amber-700 mt-1">Set this as <strong>BOT_SECRET</strong> in your bot environment.</p>
        </div>
      )}

      {connected && integration.bot_secret && !newSecret && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs text-gray-500 mb-1">BOT_SECRET (set this in your bot env):</p>
          <code className="text-xs text-gray-700 break-all font-mono">{integration.bot_secret}</code>
        </div>
      )}

      <form action={saveAction} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
          <input
            name="botToken"
            type="password"
            placeholder={connected ? '••••••••• (leave blank to keep current)' : 'Bot token from Discord Developer Portal'}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
            required={!connected}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Channel IDs (comma-separated)</label>
          <input
            name="channelIds"
            type="text"
            defaultValue={integration?.channel_ids.join(', ') ?? ''}
            placeholder="123456789, 987654321"
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
        </div>
        {(saveState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(saveState as { error?: string }).error}</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={savePending}>
            {savePending ? 'Saving…' : connected ? 'Update' : 'Connect'}
          </Button>
          {connected && (
            <form action={deleteAction}>
              <Button type="submit" size="sm" variant="danger" disabled={deletePending}>
                {deletePending ? 'Removing…' : 'Disconnect'}
              </Button>
            </form>
          )}
        </div>
      </form>
    </div>
  )
}

function SlackIntegrationCard() {
  const [integration, setIntegration] = useState<SlackIntegration | null | undefined>(undefined)
  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveSlackIntegrationAction(prev, fd)
      if (!result?.error) {
        const updated = await fetch('/api/integrations').then((r) => r.json())
        setIntegration(updated.find((i: SlackIntegration) => i.platform === 'slack') ?? null)
      }
      return result
    },
    null
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await deleteSlackIntegrationAction(prev, fd)
      if (!result?.error) setIntegration(null)
      return result
    },
    null
  )

  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((data: SlackIntegration[]) => {
        setIntegration(data.find((i) => i.platform === 'slack') ?? null)
      })
  }, [])

  if (integration === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const connected = integration !== null && integration.enabled === 1

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold">S</div>
          <div>
            <p className="text-sm font-medium text-gray-900">Slack</p>
            <p className="text-xs text-gray-500">
              {connected
                ? `Connected · Team ${integration.team_id ?? '?'} · ${integration.channel_ids.length} channel(s)`
                : 'Not connected'}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {connected ? 'Active' : 'Inactive'}
        </span>
      </div>

      <form action={saveAction} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
          <input
            name="botToken"
            type="password"
            placeholder={connected ? '••••••••• (leave blank to keep current)' : 'xoxb-…'}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
            required={!connected}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Signing Secret</label>
          <input
            name="signingSecret"
            type="password"
            placeholder={connected ? '••••••••• (leave blank to keep current)' : 'From Slack app Basic Information'}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
            required={!connected}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Team ID</label>
          <input
            name="teamId"
            type="text"
            defaultValue={integration?.team_id ?? ''}
            placeholder="T01234ABCDE"
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Channel IDs (comma-separated)</label>
          <input
            name="channelIds"
            type="text"
            defaultValue={integration?.channel_ids.join(', ') ?? ''}
            placeholder="C01234ABCDE, C09876ZYXWV"
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
        </div>
        {(saveState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(saveState as { error?: string }).error}</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={savePending}>
            {savePending ? 'Saving…' : connected ? 'Update' : 'Connect'}
          </Button>
          {connected && (
            <form action={deleteAction}>
              <Button type="submit" size="sm" variant="danger" disabled={deletePending}>
                {deletePending ? 'Removing…' : 'Disconnect'}
              </Button>
            </form>
          )}
        </div>
      </form>

      {connected && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs text-gray-500 mb-1">Events API endpoint (configure in your Slack app):</p>
          <code className="text-xs text-gray-700 break-all font-mono">{'{YOUR_DOMAIN}'}/api/slack/events</code>
        </div>
      )}

      {(deleteState as { error?: string } | null)?.error && (
        <p className="text-xs text-red-600">{(deleteState as { error?: string }).error}</p>
      )}
    </div>
  )
}

function TeamSection() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const [inviteState, inviteFormAction, invitePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await sendInviteAction(prev, fd)
      if (!result?.error) {
        await reload()
      }
      return result
    },
    null
  )

  const reload = async () => {
    const [m, i] = await Promise.all([
      fetch('/api/team/members').then((r) => r.json()),
      fetch('/api/team/invites').then((r) => r.json()),
    ])
    setMembers(m)
    setInvites(i)
  }

  useEffect(() => { reload() }, [])

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Current members */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600">Members</p>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">No members yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((m) => (
              <li key={m.membership_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{m.name ?? m.email ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{m.email} · <span className="capitalize">{m.role}</span></p>
                </div>
                <form action={async (fd) => { await removeMemberAction(null, fd); await reload() }}>
                  <input type="hidden" name="membershipId" value={m.membership_id} />
                  <input type="hidden" name="userId" value={m.user_id} />
                  <Button type="submit" size="sm" variant="ghost">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600">Pending Invites</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    <span className="capitalize">{inv.role}</span> · expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => copyLink(inv.token)}
                  >
                    {copiedToken === inv.token ? 'Copied!' : 'Copy link'}
                  </Button>
                  <form action={async (fd) => { await revokeInviteAction(null, fd); await reload() }}>
                    <input type="hidden" name="id" value={inv.id} />
                    <Button type="submit" size="sm" variant="ghost">Revoke</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Invite a teammate</p>
        <form action={inviteFormAction} className="flex gap-2 flex-wrap">
          <input
            name="email"
            type="email"
            placeholder="colleague@example.com"
            required
            className="flex-1 min-w-0 rounded border border-gray-200 px-3 py-1.5 text-sm"
          />
          <select name="role" className="rounded border border-gray-200 px-2 py-1.5 text-sm bg-white">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" size="sm" disabled={invitePending}>
            {invitePending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
        {(inviteState as { error?: string; inviteUrl?: string } | null)?.error && (
          <p className="mt-2 text-xs text-red-600">{(inviteState as { error?: string }).error}</p>
        )}
        {(inviteState as { inviteUrl?: string } | null)?.inviteUrl && (
          <div className="mt-2 rounded-md bg-indigo-50 border border-indigo-200 p-2">
            <p className="text-xs text-indigo-700 mb-1 font-medium">Invite link (copy and send to your teammate):</p>
            <code className="text-xs text-indigo-900 break-all font-mono">
              {(inviteState as { inviteUrl: string }).inviteUrl}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [addRepoState, addRepoFormAction, addRepoPending] = useActionState(addRepoAction, null)

  useEffect(() => {
    fetch('/api/github/repos').then((r) => r.json()).then(setRepos)
    // SLA configs aren't exposed via API yet — load defaults
    setSlaConfigs([
      { id: 1, priority: 'critical', response_hours: 1, resolve_hours: 4, updated_at: '' },
      { id: 2, priority: 'high', response_hours: 4, resolve_hours: 24, updated_at: '' },
      { id: 3, priority: 'medium', response_hours: 24, resolve_hours: 72, updated_at: '' },
      { id: 4, priority: 'low', response_hours: 72, resolve_hours: 168, updated_at: '' },
    ])
  }, [])

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>

      {/* SLA Configuration */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">SLA Configuration</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="px-4 py-2.5 text-left">Priority</th>
                <th className="px-4 py-2.5 text-left">Response (hours)</th>
                <th className="px-4 py-2.5 text-left">Resolve (hours)</th>
                <th className="px-4 py-2.5 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slaConfigs.map((config) => (
                <SLARow key={config.priority} config={config} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* GitHub Repositories */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">GitHub Repositories</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {repos.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
                  <th className="px-4 py-2.5 text-left">Repository</th>
                  <th className="px-4 py-2.5 text-left">Visibility</th>
                  <th className="px-4 py-2.5 text-left">Added</th>
                  <th className="px-4 py-2.5 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {repos.map((repo) => (
                  <RepoRow key={repo.id} repo={repo} onRemoved={() => setRepos((r) => r.filter((x) => x.id !== repo.id))} />
                ))}
              </tbody>
            </table>
          )}
          <div className="px-4 py-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-3">Add Repository</p>
            <form action={async (fd) => {
              await addRepoFormAction(fd)
              const updated = await fetch('/api/github/repos').then((r) => r.json())
              setRepos(updated)
            }} className="grid grid-cols-2 gap-2">
              <input name="installationId" type="number" required placeholder="Installation ID"
                className="rounded border border-gray-200 px-2 py-1.5 text-sm" />
              <input name="owner" type="text" required placeholder="owner"
                className="rounded border border-gray-200 px-2 py-1.5 text-sm" />
              <input name="repo" type="text" required placeholder="repo-name"
                className="rounded border border-gray-200 px-2 py-1.5 text-sm" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm text-gray-600">
                  <input name="isPrivate" type="checkbox" value="true" className="rounded" />
                  Private
                </label>
                <Button type="submit" size="sm" disabled={addRepoPending}>
                  {addRepoPending ? 'Adding…' : 'Add repo'}
                </Button>
              </div>
              {addRepoState?.error && <p className="col-span-2 text-xs text-red-600">{addRepoState.error}</p>}
            </form>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Get your Installation ID from: GitHub → Settings → Developer settings → GitHub Apps → your app → Installations
        </p>
      </section>

      {/* Team */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Team</h2>
        <TeamSection />
      </section>

      {/* Integrations */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Integrations</h2>
        <div className="space-y-4">
          <DiscordIntegrationCard />
          <SlackIntegrationCard />
        </div>
      </section>

      {/* Environment reminder */}
      <section className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <h2 className="text-xs font-semibold text-amber-800 mb-2">Required Environment Variables</h2>
        <ul className="text-xs text-amber-700 space-y-0.5 font-mono">
          <li>AUTH_SECRET=</li>
          <li>AUTH_DISCORD_ID= (OAuth app id)</li>
          <li>AUTH_DISCORD_SECRET= (OAuth app secret)</li>
          <li>AUTH_GOOGLE_ID=</li>
          <li>AUTH_GOOGLE_SECRET=</li>
          <li>OPENAI_API_KEY=</li>
          <li>GITHUB_APP_ID=</li>
          <li>GITHUB_APP_PRIVATE_KEY= (base64 PEM)</li>
          <li>VAPID_PUBLIC_KEY= (optional, for push)</li>
          <li>VAPID_PRIVATE_KEY=</li>
        </ul>
        <p className="text-xs text-amber-600 mt-2">Discord bot token and channel IDs are now managed via the Integrations panel above.</p>
      </section>
    </div>
  )
}
