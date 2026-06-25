'use client'

import { useActionState, useRef, useTransition } from 'react'
import { useState, useEffect } from 'react'
import { updateSLAAction } from '@/app/actions/sla'
import { addRepoAction, removeRepoAction } from '@/app/actions/github'
import { saveDiscordIntegrationAction, deleteDiscordIntegrationAction, saveSlackIntegrationAction, deleteSlackIntegrationAction } from '@/app/actions/integrations'
import { sendInviteAction, revokeInviteAction, removeMemberAction, transferOwnershipAction } from '@/app/actions/invitations'
import { getWidgetTokenAction, regenerateWidgetTokenAction } from '@/app/actions/widget'
import { saveAIConfigAction, clearAIConfigAction } from '@/app/actions/ai-config'
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

  channel_ids: string[]
  escalation_role_id: string | null
  confidence_threshold: number | null
  enabled: number
}

interface SlackIntegration {
  id: number
  platform: string
  team_id: string | null
  channel_ids: string[]
  escalation_role_id: string | null
  confidence_threshold: number | null
  enabled: number
}

function SLARow({ config }: { config: SLAConfig }) {
  const [state, formAction, isPending] = useActionState(updateSLAAction, null)

  return (
    <form action={formAction} className="grid grid-cols-4 items-center">
      <input type="hidden" name="priority" value={config.priority} />
      <div className="px-4 py-3 text-sm font-medium capitalize text-gray-800">{config.priority}</div>
      <div className="px-4 py-3">
        <input type="number" name="responseHours" defaultValue={config.response_hours} min={1}
          className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-center" />
      </div>
      <div className="px-4 py-3">
        <input type="number" name="resolveHours" defaultValue={config.resolve_hours} min={1}
          className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-center" />
      </div>
      <div className="px-4 py-3 flex items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
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
  const [, startDeleteTransition] = useTransition()
  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveDiscordIntegrationAction(prev, fd)
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

      <form action={saveAction} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
          <input
            name="botToken"
            type="password"
            autoComplete="new-password"
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
        <hr className="border-gray-100" />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Escalation Role ID <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            name="escalationRoleId"
            type="text"
            defaultValue={integration?.escalation_role_id ?? ''}
            placeholder="Discord role ID — e.g. 123456789012345678"
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">When AI confidence is below threshold, this role gets @mentioned in the thread.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Confidence threshold <span className="text-gray-400 font-normal">(0–1, default 0.8)</span>
          </label>
          <input
            name="confidenceThreshold"
            type="number"
            min="0"
            max="1"
            step="0.05"
            defaultValue={integration?.confidence_threshold ?? 0.8}
            className="w-32 rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">AI answers below this score trigger human escalation.</p>
        </div>
        {(saveState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(saveState as { error?: string }).error}</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={savePending}>
            {savePending ? 'Saving…' : connected ? 'Update' : 'Connect'}
          </Button>
          {connected && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletePending}
              onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
            >
              {deletePending ? 'Removing…' : 'Disconnect'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function SlackIntegrationCard() {
  const [integration, setIntegration] = useState<SlackIntegration | null | undefined>(undefined)
  const [, startDeleteTransition] = useTransition()
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
            autoComplete="new-password"
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
            autoComplete="new-password"
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
        <hr className="border-gray-100" />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Escalation User Group ID <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            name="escalationRoleId"
            type="text"
            defaultValue={integration?.escalation_role_id ?? ''}
            placeholder="Slack user group ID — e.g. S0123ABCDE or U0123ABCDE"
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">S… = user group, U… = individual user. Gets pinged when AI can&apos;t confidently answer.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Confidence threshold <span className="text-gray-400 font-normal">(0–1, default 0.8)</span>
          </label>
          <input
            name="confidenceThreshold"
            type="number"
            min="0"
            max="1"
            step="0.05"
            defaultValue={integration?.confidence_threshold ?? 0.8}
            className="w-32 rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
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
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletePending}
              onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
            >
              {deletePending ? 'Removing…' : 'Disconnect'}
            </Button>
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

function TransferOwnershipModal({
  target,
  onConfirm,
  onCancel,
  pending,
}: {
  target: Member
  onConfirm: () => void
  onCancel: () => void
  pending: boolean
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 mx-4">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-5 w-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900">Transfer Ownership</h2>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          You are about to transfer ownership of this workspace to{' '}
          <span className="font-medium text-gray-900">{target.name ?? target.email}</span>.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          You will become a regular member and lose owner privileges. This cannot be undone unless the new owner transfers it back.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
          >
            {pending ? 'Transferring…' : 'Yes, transfer ownership'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamSection() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [transferTarget, setTransferTarget] = useState<Member | null>(null)
  const [transferPending, setTransferPending] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((s) => {
      if (s?.user?.id) setCurrentUserId(Number(s.user.id))
    })
  }, [])

  const [inviteCopied, setInviteCopied] = useState(false)

  const [inviteState, inviteFormAction, invitePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await sendInviteAction(prev, fd)
      if (!result?.error && result?.inviteUrl) {
        await navigator.clipboard.writeText(result.inviteUrl).catch(() => {})
        setInviteCopied(true)
        setTimeout(() => setInviteCopied(false), 4000)
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
            {members.map((m) => {
              const isCurrentUser = m.user_id === currentUserId
              const isOwner = m.role === 'owner'
              const viewerIsOwner = members.find((x) => x.user_id === currentUserId)?.role === 'owner'
              const hasOtherMembers = members.length > 1

              return (
                <li key={m.membership_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.name ?? m.email ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{m.email} · <span className="capitalize">{m.role}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {viewerIsOwner && !isCurrentUser && !isOwner && hasOtherMembers && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-indigo-600 hover:text-indigo-800"
                        onClick={() => setTransferTarget(m)}
                      >
                        Transfer Ownership
                      </Button>
                    )}
                    {!isOwner && (
                      <form action={async (fd) => { await removeMemberAction(null, fd); await reload() }}>
                        <input type="hidden" name="membershipId" value={m.membership_id} />
                        <input type="hidden" name="userId" value={m.user_id} />
                        <Button type="submit" size="sm" variant="ghost">Remove</Button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
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
        {(inviteState as { error?: string } | null)?.error && (
          <p className="mt-2 text-xs text-red-600">{(inviteState as { error?: string }).error}</p>
        )}
        {inviteCopied && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-green-700 font-medium">Invite link copied to clipboard — send it to your teammate.</p>
          </div>
        )}
      </div>

      {transferTarget && (
        <TransferOwnershipModal
          target={transferTarget}
          pending={transferPending}
          onCancel={() => setTransferTarget(null)}
          onConfirm={async () => {
            setTransferPending(true)
            const fd = new FormData()
            fd.set('membershipId', String(transferTarget.membership_id))
            fd.set('userId', String(transferTarget.user_id))
            await transferOwnershipAction(null, fd)
            setTransferPending(false)
            setTransferTarget(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}

const CHAT_PROVIDERS = [
  {
    value: 'openai',
    label: 'OpenAI',
    placeholder: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o3-mini', 'o4-mini'],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    placeholder: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001', 'claude-fable-5'],
  },
  {
    value: 'google',
    label: 'Google Gemini',
    placeholder: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
  },
  {
    value: 'groq',
    label: 'Groq',
    placeholder: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  },
  {
    value: 'mistral',
    label: 'Mistral',
    placeholder: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'open-mixtral-8x22b'],
  },
  {
    value: 'openai-compatible',
    label: 'OpenAI-compatible (Ollama, LM Studio, vLLM…)',
    placeholder: 'llama3.2',
    models: [] as string[],
  },
]

const EMBEDDING_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI-compatible (Ollama, local)' },
] as const

interface AIConfig {
  chat_provider: string
  chat_model: string
  chat_api_key_set: boolean
  chat_base_url: string | null
  embedding_provider: string
  embedding_model: string
  embedding_api_key_set: boolean
  embedding_base_url: string | null
}

function AIModelSection() {
  const [config, setConfig] = useState<AIConfig | null | undefined>(undefined)
  const [chatProvider, setChatProvider] = useState('openai')
  const [embeddingProvider, setEmbeddingProvider] = useState('openai')
  const [, startClearTransition] = useTransition()

  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveAIConfigAction(prev, fd)
      if (!result?.error) {
        const updated = await fetch('/api/ai-config').then((r) => r.json())
        setConfig(updated)
        if (updated) {
          setChatProvider(updated.chat_provider)
          setEmbeddingProvider(updated.embedding_provider)
        }
      }
      return result
    },
    null
  )

  const [clearState, clearAction, clearPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await clearAIConfigAction(prev, fd)
      if (!result?.error) setConfig(null)
      return result
    },
    null
  )

  useEffect(() => {
    fetch('/api/ai-config')
      .then((r) => r.json())
      .then((data: AIConfig | null) => {
        setConfig(data)
        if (data) {
          setChatProvider(data.chat_provider)
          setEmbeddingProvider(data.embedding_provider)
        }
      })
  }, [])

  if (config === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const configured = config !== null
  const chatMeta = CHAT_PROVIDERS.find((p) => p.value === chatProvider) ?? CHAT_PROVIDERS[0]
  const needsEmbedKey = chatProvider !== 'openai' || embeddingProvider === 'openai-compatible'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">AI Model</p>
          <p className="text-xs text-gray-500">
            {configured
              ? `${chatMeta.label} · ${config.chat_model}`
              : 'Using platform default (OPENAI_API_KEY from environment)'}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${configured ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
          {configured ? 'Custom' : 'Platform default'}
        </span>
      </div>

      <form action={saveAction} className="space-y-4">
        {/* Chat provider */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Chat provider</label>
          <select
            name="chat_provider"
            value={chatProvider}
            onChange={(e) => setChatProvider(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm bg-white"
          >
            {CHAT_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Chat model */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Model ID</label>
          <input
            name="chat_model"
            type="text"
            list="chat-model-suggestions"
            defaultValue={config?.chat_model ?? ''}
            placeholder={chatMeta.placeholder}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
            required
          />
          {chatMeta.models.length > 0 && (
            <datalist id="chat-model-suggestions">
              {chatMeta.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          )}
        </div>

        {/* Chat API key */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="block text-xs font-medium text-gray-600">API key</label>
            {configured && config.chat_api_key_set
              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Key saved
                </span>
              : <span className="text-xs text-amber-600 font-medium">No key saved</span>
            }
          </div>
          <input
            name="chat_api_key"
            type="password"
            autoComplete="new-password"
            placeholder={configured && config.chat_api_key_set ? 'Leave blank to keep current key' : 'sk-…'}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
          />
          {chatProvider === 'openai-compatible' && (
            <p className="text-xs text-gray-400 mt-1">Leave blank for local endpoints that don't require auth.</p>
          )}
        </div>

        {/* Base URL — only for openai-compatible */}
        {chatProvider === 'openai-compatible' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Base URL</label>
            <input
              name="chat_base_url"
              type="url"
              defaultValue={config?.chat_base_url ?? ''}
              placeholder="http://localhost:11434/v1"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Ollama: <code>http://localhost:11434/v1</code> · LM Studio: <code>http://localhost:1234/v1</code></p>
          </div>
        )}

        <hr className="border-gray-100" />

        {/* Embedding section */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Embeddings</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Embedding provider</label>
              <select
                name="embedding_provider"
                value={embeddingProvider}
                onChange={(e) => setEmbeddingProvider(e.target.value)}
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm bg-white"
              >
                {EMBEDDING_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Embedding model</label>
              <input
                name="embedding_model"
                type="text"
                defaultValue={config?.embedding_model ?? 'text-embedding-3-small'}
                placeholder={embeddingProvider === 'openai-compatible' ? 'nomic-embed-text' : 'text-embedding-3-small'}
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
                required
              />
            </div>

            {needsEmbedKey && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-xs font-medium text-gray-600">
                    Embedding API key{chatProvider === 'openai' ? '' : ' (OpenAI key for embeddings)'}
                  </label>
                  {configured && config.embedding_api_key_set
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Key saved
                      </span>
                    : <span className="text-xs text-amber-600 font-medium">No key saved</span>
                  }
                </div>
                <input
                  name="embedding_api_key"
                  type="password"
                  autoComplete="new-password"
                  placeholder={configured && config.embedding_api_key_set ? 'Leave blank to keep current key' : 'sk-…'}
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
                />
              </div>
            )}

            {embeddingProvider === 'openai-compatible' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Embedding base URL</label>
                <input
                  name="embedding_base_url"
                  type="url"
                  defaultValue={config?.embedding_base_url ?? ''}
                  placeholder="http://localhost:11434/v1"
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {(saveState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(saveState as { error?: string }).error}</p>
        )}
        {(clearState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(clearState as { error?: string }).error}</p>
        )}

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={savePending}>
            {savePending ? 'Saving…' : configured ? 'Update' : 'Save'}
          </Button>
          {configured && (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={clearPending}
              onClick={() => startClearTransition(() => { clearAction(new FormData()) })}
            >
              {clearPending ? 'Clearing…' : 'Reset to platform default'}
            </Button>
          )}
        </div>
      </form>

      {!configured && (
        <p className="text-xs text-gray-400">
          No custom config — all AI calls use the platform <code>OPENAI_API_KEY</code> env var.
        </p>
      )}
    </div>
  )
}

function WidgetSection() {
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)

  async function loadToken() {
    setLoading(true)
    const result = await getWidgetTokenAction()
    if (result.token) { setToken(result.token); setExpiresAt(result.expiresAt ?? null) }
    setLoading(false)
  }

  useEffect(() => { loadToken() }, [])

  async function regenerate() {
    setRotating(true)
    setConfirmRotate(false)
    const result = await regenerateWidgetTokenAction()
    if (result.token) { setToken(result.token); setExpiresAt(result.expiresAt ?? null) }
    setRotating(false)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const embedCode = token
    ? `<script src="${baseUrl}/widget.js" data-widget-id="${token}"></script>`
    : ''

  const daysLeft = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null

  const expiringSoon = daysLeft !== null && daysLeft <= 14

  function copyEmbed() {
    if (!embedCode) return
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <p className="text-xs text-gray-600">
        Add a chat widget to any website. Visitors can ask questions and get answers from your knowledge base automatically.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !token ? (
        <p className="text-sm text-red-500">Failed to load widget token.</p>
      ) : (
        <div className="space-y-3">
          {expiringSoon && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-800 font-medium">
                Token expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} — regenerate it before it expires or the widget will stop working.
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">Paste this before <code className="text-indigo-600">&lt;/body&gt;</code></p>
            <div className="relative">
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap break-all">{embedCode}</pre>
              <button
                onClick={copyEmbed}
                className="absolute top-2 right-2 rounded px-2 py-1 text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <a
                href={`/widget/${token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                Preview widget ↗
              </a>
              {expiresAt && (
                <p className={`text-[10px] ${expiringSoon ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                  Expires {new Date(expiresAt).toLocaleDateString()} ({daysLeft}d left)
                </p>
              )}
            </div>

            {confirmRotate ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-red-600">Old token breaks immediately.</p>
                <Button size="sm" variant="danger" onClick={regenerate} disabled={rotating}>
                  {rotating ? 'Rotating…' : 'Confirm rotate'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRotate(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirmRotate(true)} disabled={rotating}>
                Regenerate token
              </Button>
            )}
          </div>
        </div>
      )}
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium">
            <div className="px-4 py-2.5">Priority</div>
            <div className="px-4 py-2.5">Response (hours)</div>
            <div className="px-4 py-2.5">Resolve (hours)</div>
            <div className="px-4 py-2.5" />
          </div>
          {slaConfigs.map((config) => (
            <SLARow key={config.priority} config={config} />
          ))}
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

      {/* AI Model */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">AI Model</h2>
        <AIModelSection />
      </section>

      {/* Website Widget */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Website Widget</h2>
        <WidgetSection />
      </section>
    </div>
  )
}
