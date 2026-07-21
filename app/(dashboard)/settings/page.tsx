'use client'

import { useActionState, useRef, useTransition } from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { updateSLAAction } from '@/app/actions/sla'
import { saveDiscordIntegrationAction, deleteDiscordIntegrationAction, saveSlackChannelsAction, deleteSlackIntegrationAction, saveTelegramIntegrationAction, deleteTelegramIntegrationAction, saveEmailIntegrationAction, deleteEmailIntegrationAction, connectPlatformEmailAction } from '@/app/actions/integrations'
import { sendInviteAction, revokeInviteAction, removeMemberAction, transferOwnershipAction } from '@/app/actions/invitations'
import { getWidgetTokenAction, regenerateWidgetTokenAction } from '@/app/actions/widget'
import { saveAIConfigAction, clearAIConfigAction } from '@/app/actions/ai-config'
import { saveROIConfigAction } from '@/app/actions/roi'
import { createApiKeyAction, revokeApiKeyAction } from '@/app/actions/api-keys'
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
  connected_guild_id: string | null
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

function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const show = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }
  return { toastMessage: message, showToast: show }
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
      <svg className="h-4 w-4 shrink-0 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs py-1">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-mono text-gray-700 truncate text-right">{value}</span>
    </div>
  )
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

function DiscordIntegrationCard() {
  const [integration, setIntegration] = useState<DiscordIntegration | null | undefined>(undefined)
  const [editingChannels, setEditingChannels] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])
  const { toastMessage, showToast } = useToast()
  const [, startDeleteTransition] = useTransition()
  const searchParams = useSearchParams()
  const router = useRouter()

  const reloadIntegrations = useCallback(() => {
    return fetch('/api/integrations')
      .then((r) => r.json())
      .then((data: DiscordIntegration[]) => {
        const discord = data.find((i) => i.platform === 'discord') ?? null
        setIntegration(discord)
        return discord
      })
  }, [])

  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveDiscordIntegrationAction(prev, fd)
      if (!result?.error) {
        await reloadIntegrations()
        setEditingChannels(false)
        showToast('Discord settings updated')
      }
      return result
    },
    null
  )

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await deleteDiscordIntegrationAction(prev, fd)
      if (!result?.error) { setIntegration(null); setEditingChannels(false); setChannels([]) }
      return result
    },
    null
  )

  useEffect(() => {
    reloadIntegrations()
  }, [reloadIntegrations])

  // Handle redirect back from Discord OAuth
  useEffect(() => {
    const connected = searchParams.get('discord_connected')
    const error = searchParams.get('discord_error')
    if (connected === '1') {
      reloadIntegrations().then(() => {
        showToast('Discord server connected! Select channels below.')
        setEditingChannels(true)
      })
      // Remove params from URL without page reload
      const url = new URL(window.location.href)
      url.searchParams.delete('discord_connected')
      url.searchParams.delete('guild_id')
      router.replace(url.pathname + url.search, { scroll: false })
    } else if (error) {
      showToast(`Discord connection failed: ${error}`)
      const url = new URL(window.location.href)
      url.searchParams.delete('discord_error')
      router.replace(url.pathname + url.search, { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When guild is connected and channels aren't loaded yet, fetch them
  useEffect(() => {
    if (!integration?.connected_guild_id || channels.length > 0) return
    fetch(`/api/discord/guilds?guild_id=${integration.connected_guild_id}`)
      .then((r) => r.json())
      .then((data: { channels?: { id: string; name: string }[] }) => {
        setChannels(data.channels ?? [])
      })
      .catch(() => null)
  }, [integration?.connected_guild_id, channels.length])

  async function handleAddToDiscord() {
    setInviting(true)
    try {
      const res = await fetch('/api/discord/invite-url')
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast(data.error ?? 'Failed to get invite URL')
        setInviting(false)
      }
    } catch {
      showToast('Failed to get invite URL')
      setInviting(false)
    }
  }

  if (integration === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const connected = integration !== null && integration.enabled === 1
  const isOAuthConnected = connected && !!integration.connected_guild_id

  return (
    <>
      {toastMessage && <Toast message={toastMessage} />}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-sm font-bold">D</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Discord</p>
              <p className="text-xs text-gray-500">
                {isOAuthConnected
                  ? `Server connected · ${integration.channel_ids.length} channel(s) monitored`
                  : connected
                  ? `Connected · ${integration.channel_ids.length} channel(s)`
                  : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {connected ? 'Active' : 'Inactive'}
            </span>
            {isOAuthConnected && !editingChannels && (
              <Button size="sm" variant="secondary" onClick={() => setEditingChannels(true)}>
                Edit channels
              </Button>
            )}
          </div>
        </div>

        {/* One-click connect button — shown when not yet connected via OAuth */}
        {!isOAuthConnected && !connected && (
          <div className="rounded-lg bg-brand-50 border border-brand-100 p-4 space-y-3">
            <p className="text-sm text-gray-700">
              Add AnswerLoops to your Discord server with one click — no bot token or Developer Portal required.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={inviting}
              onClick={handleAddToDiscord}
            >
              {inviting ? 'Redirecting…' : 'Add AnswerLoops to Discord'}
            </Button>
          </div>
        )}

        {/* Legacy manual setup — shown only when already connected without OAuth guild */}
        {connected && !isOAuthConnected && !editingChannels && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 divide-y divide-gray-100">
            <ReadOnlyRow label="Bot Token" value="••••••••• (saved)" />
            <ReadOnlyRow label="Channel IDs" value={integration.channel_ids.join(', ') || '—'} />
            {integration.escalation_role_id && (
              <ReadOnlyRow label="Escalation Role ID" value={integration.escalation_role_id} />
            )}
            <ReadOnlyRow label="Confidence threshold" value={String(integration.confidence_threshold ?? 0.8)} />
          </div>
        )}

        {/* OAuth-connected summary */}
        {isOAuthConnected && !editingChannels && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 divide-y divide-gray-100">
            <ReadOnlyRow label="Server ID" value={integration.connected_guild_id!} />
            <ReadOnlyRow label="Monitored channels" value={integration.channel_ids.join(', ') || '— (none selected)'} />
            {integration.escalation_role_id && (
              <ReadOnlyRow label="Escalation Role ID" value={integration.escalation_role_id} />
            )}
            <ReadOnlyRow label="Confidence threshold" value={String(integration.confidence_threshold ?? 0.8)} />
          </div>
        )}

        {/* Channel picker — shown after OAuth connect or when editing */}
        {(isOAuthConnected && editingChannels) && (
          <form action={saveAction} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Channels to monitor
                {channels.length === 0 && <span className="text-gray-400 font-normal ml-1">(loading…)</span>}
              </label>
              {channels.length > 0 ? (
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto rounded border border-gray-200 p-2 bg-white">
                  {channels.map((ch) => (
                    <label key={ch.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        name="channelIds"
                        value={ch.id}
                        defaultChecked={integration.channel_ids.includes(ch.id)}
                        className="rounded"
                      />
                      #{ch.name}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  name="channelIds"
                  type="text"
                  defaultValue={integration.channel_ids.join(', ')}
                  placeholder="123456789, 987654321"
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
                />
              )}
            </div>
            <hr className="border-gray-100" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Escalation Role ID <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                name="escalationRoleId"
                type="text"
                defaultValue={integration.escalation_role_id ?? ''}
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
                defaultValue={integration.confidence_threshold ?? 0.8}
                className="w-32 rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">AI answers below this score trigger human escalation.</p>
            </div>
            {(saveState as { error?: string } | null)?.error && (
              <p className="text-xs text-red-600">{(saveState as { error?: string }).error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={savePending}>
                {savePending ? 'Saving…' : 'Save channels'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingChannels(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={deletePending}
                onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
              >
                {deletePending ? 'Removing…' : 'Disconnect'}
              </Button>
            </div>
          </form>
        )}

        {/* Disconnect button for legacy (non-OAuth) connected state */}
        {connected && !isOAuthConnected && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditingChannels(true)}>
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletePending}
              onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
            >
              {deletePending ? 'Removing…' : 'Disconnect'}
            </Button>
          </div>
        )}

        {(deleteState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(deleteState as { error?: string }).error}</p>
        )}
      </div>
    </>
  )
}

function SlackIntegrationCard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [integration, setIntegration] = useState<SlackIntegration | null | undefined>(undefined)
  const [editingChannels, setEditingChannels] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const { toastMessage, showToast } = useToast()
  const [, startDeleteTransition] = useTransition()

  const reload = useCallback(async () => {
    const data: SlackIntegration[] = await fetch('/api/integrations').then((r) => r.json())
    const found = data.find((i) => i.platform === 'slack') ?? null
    setIntegration(found)
    if (found) setSelectedChannels(found.channel_ids)
  }, [])

  useEffect(() => { reload() }, [reload])

  // Handle redirect back from Slack OAuth
  useEffect(() => {
    const connected = searchParams.get('slack_connected')
    const error = searchParams.get('slack_error')
    const team = searchParams.get('slack_team')
    if (connected === '1') {
      reload().then(() => {
        showToast(`Slack connected${team ? ` · ${team}` : ''}! Select channels below.`)
        setEditingChannels(true)
      })
      const url = new URL(window.location.href)
      url.searchParams.delete('slack_connected')
      url.searchParams.delete('slack_team')
      router.replace(url.pathname + url.search, { scroll: false })
    } else if (error) {
      showToast(`Slack connection failed: ${error}`)
      const url = new URL(window.location.href)
      url.searchParams.delete('slack_error')
      router.replace(url.pathname + url.search, { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load channel list when entering channel-editing mode
  useEffect(() => {
    if (!editingChannels || channels.length > 0) return
    setLoadingChannels(true)
    fetch('/api/slack/channels')
      .then((r) => r.json())
      .then((data: { id: string; name: string }[] | { error: string }) => {
        if (Array.isArray(data)) setChannels(data)
      })
      .catch(() => null)
      .finally(() => setLoadingChannels(false))
  }, [editingChannels, channels.length])

  const [channelSaveState, channelSaveAction, channelSavePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveSlackChannelsAction(prev, fd)
      if (!result?.error) {
        await reload()
        setEditingChannels(false)
        showToast('Slack channels saved')
      }
      return result
    },
    null
  )

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await deleteSlackIntegrationAction(prev, fd)
      if (!result?.error) {
        setIntegration(null)
        setEditingChannels(false)
        setChannels([])
        setSelectedChannels([])
      }
      return result
    },
    null
  )

  async function handleConnectSlack() {
    setConnecting(true)
    try {
      const res = await fetch('/api/slack/install')
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast(data.error ?? 'Failed to get Slack install URL')
        setConnecting(false)
      }
    } catch {
      showToast('Failed to connect to Slack')
      setConnecting(false)
    }
  }

  function toggleChannel(id: string) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  if (integration === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const connected = integration !== null && integration.enabled === 1
  const hasChannels = connected && integration.channel_ids.length > 0

  return (
    <>
      {toastMessage && <Toast message={toastMessage} />}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold">S</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Slack</p>
              <p className="text-xs text-gray-500">
                {hasChannels
                  ? `Connected · Team ${integration.team_id ?? '?'} · ${integration.channel_ids.length} channel(s)`
                  : connected
                  ? 'Connected — no channels selected yet'
                  : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasChannels ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {hasChannels ? 'Active' : 'Inactive'}
            </span>
            {connected && !editingChannels && (
              <Button size="sm" variant="secondary" onClick={() => setEditingChannels(true)}>
                Edit channels
              </Button>
            )}
          </div>
        </div>

        {/* Not connected: 1-click OAuth */}
        {!connected && !showManual && (
          <div className="space-y-3">
            <Button onClick={handleConnectSlack} disabled={connecting} size="sm">
              {connecting ? 'Redirecting…' : 'Add to Slack'}
            </Button>
            <p className="text-xs text-gray-400">
              Polling mode — no admin webhook required.{' '}
              <button
                type="button"
                className="underline text-gray-500 hover:text-gray-700"
                onClick={() => setShowManual(true)}
              >
                Set up manually instead
              </button>
            </p>
          </div>
        )}

        {/* Manual token entry (polling path — no OAuth) */}
        {!connected && showManual && (
          <ManualSlackForm
            onSaved={() => { reload(); showToast('Slack saved — polling mode active') }}
            onCancel={() => setShowManual(false)}
          />
        )}

        {/* Connected summary */}
        {connected && !editingChannels && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 divide-y divide-gray-100">
            <ReadOnlyRow label="Bot Token" value="••••••••• (saved)" />
            {integration.team_id && <ReadOnlyRow label="Team ID" value={integration.team_id} />}
            <ReadOnlyRow label="Channels" value={integration.channel_ids.join(', ') || '— none selected'} />
            {integration.escalation_role_id && (
              <ReadOnlyRow label="Escalation Group ID" value={integration.escalation_role_id} />
            )}
            <ReadOnlyRow label="Confidence threshold" value={String(integration.confidence_threshold ?? 0.8)} />
          </div>
        )}

        {/* Channel picker (shown after OAuth or when editing) */}
        {connected && editingChannels && (
          <form
            action={(fd) => {
              fd.set('channelIds', selectedChannels.join(','))
              return channelSaveAction(fd)
            }}
            className="space-y-3"
          >
            <p className="text-xs font-medium text-gray-700">Select channels to monitor</p>
            {loadingChannels ? (
              <p className="text-xs text-gray-400">Loading channels…</p>
            ) : channels.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100">
                {channels.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">#{ch.name}</span>
                    <span className="text-xs text-gray-400 font-mono ml-auto">{ch.id}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Could not load channel list. Enter channel IDs manually:</p>
                <input
                  name="channelIds"
                  type="text"
                  defaultValue={integration.channel_ids.join(', ')}
                  placeholder="C01234ABCDE, C09876ZYXWV"
                  className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
                  onChange={(e) => setSelectedChannels(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Escalation User Group ID <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                name="escalationRoleId"
                type="text"
                defaultValue={integration.escalation_role_id ?? ''}
                placeholder="S0123ABCDE or U0123ABCDE"
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confidence threshold <span className="text-gray-400 font-normal">(0–1)</span></label>
              <input
                name="confidenceThreshold"
                type="number"
                min="0"
                max="1"
                step="0.05"
                defaultValue={integration.confidence_threshold ?? 0.8}
                className="w-32 rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            {(channelSaveState as { error?: string } | null)?.error && (
              <p className="text-xs text-red-600">{(channelSaveState as { error?: string }).error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={channelSavePending}>
                {channelSavePending ? 'Saving…' : 'Save channels'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingChannels(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={deletePending}
                onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
              >
                {deletePending ? 'Removing…' : 'Disconnect'}
              </Button>
            </div>
          </form>
        )}

        {connected && !editingChannels && (
          <div className="space-y-2">
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Events API endpoint (for webhook mode):</p>
              <code className="text-xs text-gray-700 break-all font-mono">{'{YOUR_DOMAIN}'}/api/slack/events</code>
            </div>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletePending}
              onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
            >
              {deletePending ? 'Removing…' : 'Disconnect Slack'}
            </Button>
          </div>
        )}

        {(deleteState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(deleteState as { error?: string }).error}</p>
        )}
      </div>
    </>
  )
}

function ManualSlackForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    // Import inline to avoid circular — action is already imported at top of file
    const { saveSlackIntegrationAction } = await import('@/app/actions/integrations')
    const result = await saveSlackIntegrationAction(null, fd)
    setSaving(false)
    if (result?.error) { setError(result.error); return }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 pt-3">
      <p className="text-xs text-gray-500 font-medium">Polling mode — no webhook required</p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
        <input name="botToken" type="password" autoComplete="new-password" placeholder="xoxb-…" className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Signing Secret <span className="text-gray-400 font-normal">(optional for polling)</span></label>
        <input name="signingSecret" type="password" autoComplete="new-password" placeholder="From Slack app Basic Information" className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Team ID</label>
        <input name="teamId" type="text" placeholder="T01234ABCDE" className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Channel IDs (comma-separated)</label>
        <input name="channelIds" type="text" placeholder="C01234ABCDE, C09876ZYXWV" className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Connect'}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

interface TelegramIntegration {
  id: number
  platform: string
  channel_ids: string[]
  escalation_role_id: string | null
  confidence_threshold: number | null
  enabled: number
}

function TelegramIntegrationCard() {
  const [integration, setIntegration] = useState<TelegramIntegration | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [registering, setRegistering] = useState(false)
  const { toastMessage, showToast } = useToast()
  const [, startDeleteTransition] = useTransition()

  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveTelegramIntegrationAction(prev, fd)
      if (!result?.error) {
        const updated = await fetch('/api/integrations').then((r) => r.json())
        setIntegration(updated.find((i: TelegramIntegration) => i.platform === 'telegram') ?? null)
        setEditing(false)
        showToast('Telegram settings updated')
      }
      return result
    },
    null
  )

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await deleteTelegramIntegrationAction(prev, fd)
      if (!result?.error) { setIntegration(null); setEditing(false) }
      return result
    },
    null
  )

  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((data: TelegramIntegration[]) => {
        setIntegration(data.find((i) => i.platform === 'telegram') ?? null)
      })
  }, [])

  async function handleRegisterWebhook() {
    setRegistering(true)
    try {
      const res = await fetch('/api/telegram/register', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; error?: string; webhookUrl?: string }
      if (data.ok) {
        showToast(`Webhook registered at ${data.webhookUrl}`)
      } else {
        showToast(data.error ?? 'Failed to register webhook')
      }
    } catch {
      showToast('Failed to register webhook')
    } finally {
      setRegistering(false)
    }
  }

  if (integration === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const connected = integration !== null && integration.enabled === 1
  const showForm = !connected || editing

  return (
    <>
      {toastMessage && <Toast message={toastMessage} />}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-sm font-bold">T</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Telegram</p>
              <p className="text-xs text-gray-500">
                {connected
                  ? `Connected · ${integration.channel_ids.length} chat(s) monitored`
                  : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {connected ? 'Active' : 'Inactive'}
            </span>
            {connected && !editing && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {connected && !editing && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 divide-y divide-gray-100">
            <ReadOnlyRow label="Bot Token" value="••••••••• (saved)" />
            <ReadOnlyRow label="Monitored chats" value={integration.channel_ids.join(', ') || '— (all chats)'} />
            {integration.escalation_role_id && (
              <ReadOnlyRow label="Escalation username" value={integration.escalation_role_id} />
            )}
            <ReadOnlyRow label="Confidence threshold" value={String(integration.confidence_threshold ?? 0.8)} />
          </div>
        )}

        {connected && !editing && (
          <div className="rounded-md bg-sky-50 border border-sky-100 p-3">
            <p className="text-xs text-sky-700 mb-2">
              After saving your token, register the webhook so Telegram starts delivering messages.
            </p>
            <Button type="button" size="sm" variant="secondary" disabled={registering} onClick={handleRegisterWebhook}>
              {registering ? 'Registering…' : 'Register webhook'}
            </Button>
          </div>
        )}

        {showForm && (
          <form key={editing ? 'edit' : 'new'} action={saveAction} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
              <input
                name="botToken"
                type="password"
                autoComplete="new-password"
                placeholder={connected ? '••••••••• (leave blank to keep current)' : '123456789:AAHdqTcv... (from @BotFather)'}
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Chat IDs to monitor <span className="text-gray-400 font-normal">(optional — leave blank to monitor all)</span>
              </label>
              <input
                name="chatIds"
                type="text"
                defaultValue={integration?.channel_ids.join(', ') ?? ''}
                placeholder="-1001234567890, -1009876543210"
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Group/supergroup chat IDs are negative numbers. Forward a message to @userinfobot to get the chat ID.</p>
            </div>
            <hr className="border-gray-100" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Escalation username <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                name="escalationUsername"
                type="text"
                defaultValue={integration?.escalation_role_id ?? ''}
                placeholder="username (without @)"
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Mentioned when AI confidence is below threshold.</p>
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
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
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
        )}

        {(deleteState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(deleteState as { error?: string }).error}</p>
        )}
      </div>
    </>
  )
}

interface EmailIntegration {
  id: number
  platform: string
  bot_token: string | null
  channel_ids: string[]
  escalation_role_id: string | null
  confidence_threshold: number | null
  inbound_address: string | null
  enabled: number
  bot_secret?: string | null
}

function EmailIntegrationCard() {
  const [integration, setIntegration] = useState<EmailIntegration | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toastMessage, showToast } = useToast()
  const [, startDeleteTransition] = useTransition()

  const [connectState, connectAction, connectPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await connectPlatformEmailAction(prev, fd)
      if (result && !('error' in result && result.error)) {
        const updated = await fetch('/api/integrations').then((r) => r.json())
        setIntegration(updated.find((i: EmailIntegration) => i.platform === 'email') ?? null)
        showToast('Email connected')
      }
      return result
    },
    null
  )

  const [saveState, saveAction, savePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveEmailIntegrationAction(prev, fd)
      if (result && !('error' in result && result.error)) {
        const updated = await fetch('/api/integrations').then((r) => r.json())
        setIntegration(updated.find((i: EmailIntegration) => i.platform === 'email') ?? null)
        setEditing(false)
        showToast('Email settings saved')
        if ('webhookSecret' in result && result.webhookSecret) {
          setWebhookSecret(result.webhookSecret as string)
        }
      }
      return result
    },
    null
  )

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await deleteEmailIntegrationAction(prev, fd)
      if (!result?.error) { setIntegration(null); setEditing(false); setWebhookSecret(null) }
      return result
    },
    null
  )

  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then((data: EmailIntegration[]) => {
        setIntegration(data.find((i) => i.platform === 'email') ?? null)
      })
  }, [])

  if (integration === undefined) return <p className="text-sm text-gray-400">Loading…</p>

  const connected = integration !== null && integration.enabled === 1
  const hosted = connected && !!integration?.inbound_address
  const showForm = advancedOpen && (!connected || editing)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function copyAddress() {
    if (!integration?.inbound_address) return
    navigator.clipboard.writeText(integration.inbound_address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {toastMessage && <Toast message={toastMessage} />}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-bold">@</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Email</p>
              <p className="text-xs text-gray-500">
                {hosted
                  ? 'Connected · platform-hosted address'
                  : connected
                    ? `Connected · replies from ${integration.bot_token ?? 'RESEND_FROM'}`
                    : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {connected ? 'Active' : 'Inactive'}
            </span>
            {connected && !editing && hosted && (
              <Button
                size="sm"
                variant="danger"
                disabled={deletePending}
                onClick={() => startDeleteTransition(() => { deleteAction(new FormData()) })}
              >
                {deletePending ? 'Removing…' : 'Disconnect'}
              </Button>
            )}
          </div>
        </div>

        {!connected && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-3">
            <p className="text-sm text-blue-900">
              Get a ready-to-use support inbox address — no email provider account, API key, or DNS setup required.
            </p>
            <form action={connectAction}>
              <Button type="submit" size="sm" disabled={connectPending}>
                {connectPending ? 'Connecting…' : 'Connect email'}
              </Button>
            </form>
            {(connectState as { error?: string } | null)?.error && (
              <p className="text-xs text-red-600">{(connectState as { error?: string }).error}</p>
            )}
          </div>
        )}

        {hosted && !editing && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Your support inbox address</p>
            <p className="text-xs text-gray-500">
              Share this address with customers, or forward your existing support mailbox to it.
            </p>
            <div className="relative">
              <code className="block text-xs font-mono text-gray-900 bg-white border border-gray-200 rounded px-3 py-2 pr-16 break-all">
                {integration?.inbound_address}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="absolute top-2 right-2 rounded px-2 py-1 text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {connected && !editing && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 divide-y divide-gray-100">
            {!hosted && <ReadOnlyRow label="Reply-from address" value={integration.bot_token ?? '— (uses RESEND_FROM env var)'} />}
            <ReadOnlyRow label="Allowed senders" value={integration.channel_ids.join(', ') || '— (all senders)'} />
            {integration.escalation_role_id && (
              <ReadOnlyRow label="Escalation email" value={integration.escalation_role_id} />
            )}
            <ReadOnlyRow label="Confidence threshold" value={String(integration.confidence_threshold ?? 0.8)} />
          </div>
        )}

        {connected && !editing && (
          <button
            type="button"
            onClick={() => { setAdvancedOpen((v) => !v); setEditing(false) }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {advancedOpen ? 'Hide advanced settings' : 'Advanced settings'}
          </button>
        )}

        {connected && advancedOpen && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit sender filters / escalation
          </Button>
        )}

        {!connected && (
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {advancedOpen ? 'Hide advanced: bring your own provider' : 'Advanced: bring your own email provider'}
          </button>
        )}

        {/* Legacy BYO-provider webhook endpoint info — only relevant off the hosted path */}
        {!hosted && (connected || webhookSecret) && (
          <div className="rounded-md bg-amber-50 border border-amber-100 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800">Webhook endpoint</p>
            <p className="text-xs text-amber-700">
              Configure your email provider (SendGrid, Mailgun, Postmark, Cloudflare Email Routing) to POST inbound emails to:
            </p>
            <code className="block text-xs font-mono text-amber-900 break-all">{baseUrl}/api/email/ingest</code>
            {webhookSecret && (
              <>
                <p className="text-xs text-amber-700 mt-1">Set the <code className="font-mono">X-Email-Webhook-Secret</code> header to:</p>
                <code className="block text-xs font-mono text-amber-900 break-all select-all">{webhookSecret}</code>
                <p className="text-xs text-gray-400">Save this — it will not be shown again.</p>
              </>
            )}
          </div>
        )}

        {showForm && (
          <form key={editing ? 'edit' : 'new'} action={saveAction} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reply-from address <span className="text-gray-400 font-normal">(optional — defaults to RESEND_FROM env var)</span>
              </label>
              <input
                name="replyFromAddress"
                type="email"
                defaultValue={integration?.bot_token ?? ''}
                placeholder="support@yourcompany.com"
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Allowed sender addresses/domains <span className="text-gray-400 font-normal">(optional — leave blank to accept all)</span>
              </label>
              <input
                name="allowedSenders"
                type="text"
                defaultValue={integration?.channel_ids.join(', ') ?? ''}
                placeholder="example.com, partner@other.com"
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Accepts full email addresses or domains. Filters out noise from unknown senders.</p>
            </div>
            <hr className="border-gray-100" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Escalation email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                name="escalationEmail"
                type="email"
                defaultValue={integration?.escalation_role_id ?? ''}
                placeholder="team@yourcompany.com"
                className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Referenced in replies when AI confidence is below threshold.</p>
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
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
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
        )}

        {(deleteState as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(deleteState as { error?: string }).error}</p>
        )}
      </div>
    </>
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

  // Live-update when a team member accepts an invite — no polling needed.
  useEffect(() => {
    const es = new EventSource('/api/events/stream')
    es.addEventListener('connected', () => console.log('[sse] connected'))
    es.addEventListener('member_joined', () => {
      console.log('[sse] member_joined received — reloading team')
      reload()
    })
    es.onerror = (e) => console.error('[sse] error', e)
    return () => es.close()
  }, [])

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
                        className="text-brand-600 hover:text-brand-800"
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
  const [editing, setEditing] = useState(false)
  const { toastMessage, showToast } = useToast()
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
        setEditing(false)
        showToast('AI model settings updated')
      }
      return result
    },
    null
  )

  const [clearState, clearAction, clearPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await clearAIConfigAction(prev, fd)
      if (!result?.error) { setConfig(null); setEditing(false) }
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
  const showForm = !configured || editing

  return (
    <>
      {toastMessage && <Toast message={toastMessage} />}
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
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${configured ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
              {configured ? 'Custom' : 'Platform default'}
            </span>
            {configured && !editing && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Locked summary */}
        {configured && !editing && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 divide-y divide-gray-100">
            <ReadOnlyRow label="Chat provider" value={chatMeta.label} />
            <ReadOnlyRow label="Model" value={config.chat_model} />
            <ReadOnlyRow label="Chat API key" value={config.chat_api_key_set ? '••••••••• (saved)' : 'Not set'} />
            {config.chat_base_url && <ReadOnlyRow label="Base URL" value={config.chat_base_url} />}
            <ReadOnlyRow label="Embedding provider" value={EMBEDDING_PROVIDERS.find(p => p.value === config.embedding_provider)?.label ?? config.embedding_provider} />
            <ReadOnlyRow label="Embedding model" value={config.embedding_model} />
            {config.embedding_api_key_set && <ReadOnlyRow label="Embedding API key" value="••••••••• (saved)" />}
          </div>
        )}

        {/* Edit form */}
        {showForm && (
          <form key={editing ? 'edit' : 'new'} action={saveAction} className="space-y-4">
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
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
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
        )}

        {!configured && (
          <p className="text-xs text-gray-400">
            No custom config — all AI calls use the platform <code>OPENAI_API_KEY</code> env var.
          </p>
        )}
      </div>
    </>
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
            <p className="text-xs font-medium text-gray-600 mb-1.5">Paste this before <code className="text-brand-600">&lt;/body&gt;</code></p>
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
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
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

interface ApiKeyRow {
  id: number
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/api-keys')
    if (res.ok) setKeys(await res.json())
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  const [createState, createAction, creating] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await createApiKeyAction(prev, fd)
      if (result && !result.error) {
        setNewKeyName('')
        if (result.plaintextKey) setPlaintextKey(result.plaintextKey)
        await loadKeys()
      }
      return result
    },
    null
  )

  function revoke(keyId: number) {
    setConfirmRevoke(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('keyId', String(keyId))
      await revokeApiKeyAction(null, fd)
      await loadKeys()
    })
  }

  function copyKey() {
    if (!plaintextKey) return
    navigator.clipboard.writeText(plaintextKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const mcpConfig = `{
  "mcpServers": {
    "answerloops": {
      "url": "${baseUrl}/api/mcp",
      "headers": { "Authorization": "Bearer ${plaintextKey ?? 'al_live_xxxx'}" }
    }
  }
}`

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <p className="text-xs text-gray-600">
          API keys let AI agents (Claude Code, Cursor, or any MCP-compatible client) call AnswerLoops directly —
          searching your knowledge base, checking tickets, and answering questions using your community&apos;s data,
          scoped to this org. See <a href="https://answerloops.mintlify.site/integrations/mcp" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">the MCP docs</a> for setup.
        </p>

        <form action={createAction} className="flex gap-2">
          <input
            name="name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Claude Code (laptop)"
            className="flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm"
            maxLength={100}
          />
          <select
            name="expiresInDays"
            defaultValue=""
            className="rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
            title="Expiry"
          >
            <option value="">Never expires</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
          <Button type="submit" size="sm" disabled={creating || !newKeyName.trim()}>
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        </form>
        {createState?.error && <p className="text-xs text-red-600">{createState.error}</p>}

        {plaintextKey && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800">Copy this now — it won&apos;t be shown again.</p>
            <div className="relative">
              <code className="block text-xs font-mono text-amber-900 bg-white border border-amber-200 rounded px-3 py-2 pr-16 break-all select-all">
                {plaintextKey}
              </code>
              <button
                type="button"
                onClick={copyKey}
                className="absolute top-2 right-2 rounded px-2 py-1 text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs font-medium text-amber-800 pt-1">Drop this in your MCP client config:</p>
            <pre className="bg-gray-950 text-emerald-400 rounded-lg p-3 text-[11px] font-mono overflow-x-auto whitespace-pre">{mcpConfig}</pre>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {keys === null ? (
          <p className="text-sm text-gray-400 p-4">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">No API keys yet.</p>
        ) : (
          keys.map((k) => {
            const revoked = !!k.revoked_at
            const expired = !revoked && !!k.expires_at && new Date(k.expires_at) < new Date()
            return (
              <div key={k.id} className={`flex items-center justify-between px-4 py-3 ${revoked || expired ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-400 font-mono">
                    {k.key_prefix}••••••••
                    {revoked ? ' · revoked' : expired ? ' · expired' : k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : ' · never used'}
                    {!revoked && !expired && k.expires_at ? ` · expires ${new Date(k.expires_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {!revoked && (
                  confirmRevoke === k.id ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="danger" onClick={() => revoke(k.id)}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(k.id)}>Revoke</Button>
                  )
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function GitHubIntegrationCard() {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const { toastMessage, showToast } = useToast()
  const searchParams = useSearchParams()

  const reload = useCallback(() => {
    fetch('/api/github/repos').then((r) => r.json()).then(setRepos)
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (searchParams.get('github_connected') === '1') showToast('GitHub connected')
    if (searchParams.get('github_error')) showToast('GitHub connection failed. Try again.')
  }, [searchParams, showToast])

  const connect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/github/install-url')
      const data = await res.json()
      if (!res.ok || !data.url) {
        showToast(data.error ?? 'GitHub App not configured — set GITHUB_APP_SLUG env var')
        setConnecting(false)
        return
      }
      window.location.href = data.url
    } catch {
      showToast('Failed to get GitHub install URL')
      setConnecting(false)
    }
  }

  const updateSettings = async (repoId: number, patch: { monitoredEvents?: string; kbEnabled?: number }) => {
    await fetch('/api/github/repo-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId, ...patch }),
    })
    reload()
  }

  const syncKB = async (repoId: number) => {
    setSyncingId(repoId)
    try {
      const { synced } = await fetch(`/api/github/sync-kb?repo_id=${repoId}`).then((r) => r.json())
      showToast(`Synced ${synced} chunks to KB`)
      reload()
    } catch {
      showToast('KB sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const removeRepo = async (repoId: number) => {
    await fetch(`/api/github/repos/${repoId}`, { method: 'DELETE' })
    reload()
  }

  return (
    <div className="space-y-3">
      {toastMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{toastMessage}</div>
      )}

      {repos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-8 text-center">
          <p className="text-sm font-medium text-gray-800 mb-1">Connect GitHub</p>
          <p className="text-xs text-gray-500 mb-1 max-w-sm mx-auto">Use repos as a support channel — turn Issues and Discussions into tickets with AI responses — or as a knowledge base by syncing your markdown docs.</p>
          <p className="text-xs text-amber-600 mb-5">You must be an org admin to install the GitHub App on an organization.</p>
          <Button onClick={connect} disabled={connecting}>
            {connecting ? 'Redirecting…' : 'Connect GitHub'}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {repos.map((repo) => (
              <div key={repo.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Repo header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800 font-mono">{repo.owner}/{repo.repo}</p>
                    <p className="text-xs text-gray-400">{repo.is_private ? 'Private' : 'Public'} · Added {new Date(repo.added_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeRepo(repo.id)}>Remove</Button>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* ── Support ──────────────────────────────────────── */}
                  <div className="px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 mb-0.5">Support</p>
                        <p className="text-xs text-gray-500">Turn Issues and Discussions into tickets. AI drafts responses and routes to your team.</p>
                      </div>
                      <select
                        value={repo.monitored_events}
                        onChange={(e) => updateSettings(repo.id, { monitoredEvents: e.target.value })}
                        className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 shrink-0 mt-0.5"
                      >
                        <option value="both">Issues + Discussions</option>
                        <option value="issues">Issues only</option>
                        <option value="discussions">Discussions only</option>
                        <option value="none">Off</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Knowledge Base ───────────────────────────────── */}
                  <div className="px-4 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 mb-0.5">Knowledge Base</p>
                        <p className="text-xs text-gray-500">Sync markdown files from this repo as KB articles so the AI can reference your docs when answering questions.</p>
                      </div>
                      <label className="flex items-center gap-2 shrink-0 mt-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={repo.kb_enabled === 1}
                          onChange={(e) => updateSettings(repo.id, { kbEnabled: e.target.checked ? 1 : 0 })}
                          className="rounded"
                        />
                        <span className="text-xs text-gray-600">{repo.kb_enabled === 1 ? 'On' : 'Off'}</span>
                      </label>
                    </div>

                    {repo.kb_enabled === 1 && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                        <p className="text-xs text-gray-500">
                          {repo.kb_chunk_count > 0
                            ? `${repo.kb_chunk_count} chunks · last synced ${repo.kb_last_synced ? new Date(repo.kb_last_synced).toLocaleDateString() : 'never'}`
                            : 'Not yet synced'}
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => syncKB(repo.id)}
                          disabled={syncingId === repo.id}
                        >
                          {syncingId === repo.id ? 'Syncing…' : 'Sync now'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="secondary" size="sm" onClick={connect} disabled={connecting}>
            {connecting ? 'Redirecting…' : '+ Add more repos'}
          </Button>
        </>
      )}
    </div>
  )
}

const TABS = [
  { id: 'general',   label: 'General' },
  { id: 'team',      label: 'Team' },
  { id: 'discord',   label: 'Discord' },
  { id: 'slack',     label: 'Slack' },
  { id: 'telegram',  label: 'Telegram' },
  { id: 'email',     label: 'Email' },
  { id: 'github',    label: 'GitHub' },
  { id: 'ai',        label: 'AI Model' },
  { id: 'widget',    label: 'Widget' },
  { id: 'api-keys',  label: 'API Keys' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([])

  const activeTab = (searchParams.get('tab') as TabId) ?? 'general'

  const setTab = (id: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', id)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    setSlaConfigs([
      { id: 1, priority: 'critical', response_hours: 1, resolve_hours: 4, updated_at: '' },
      { id: 2, priority: 'high', response_hours: 4, resolve_hours: 24, updated_at: '' },
      { id: 3, priority: 'medium', response_hours: 24, resolve_hours: 72, updated_at: '' },
      { id: 4, priority: 'low', response_hours: 72, resolve_hours: 168, updated_at: '' },
    ])
  }, [])

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={[
              'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'general' && (
        <div className="space-y-8">
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
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Analytics</h2>
            <ROISection />
          </section>
        </div>
      )}

      {activeTab === 'team' && (
        <section>
          <TeamSection />
        </section>
      )}

      {activeTab === 'discord' && (
        <section>
          <DiscordIntegrationCard />
        </section>
      )}

      {activeTab === 'slack' && (
        <section>
          <SlackIntegrationCard />
        </section>
      )}

      {activeTab === 'telegram' && (
        <section>
          <TelegramIntegrationCard />
        </section>
      )}

      {activeTab === 'email' && (
        <section>
          <EmailIntegrationCard />
        </section>
      )}

      {activeTab === 'github' && (
        <section>
          <GitHubIntegrationCard />
        </section>
      )}

      {activeTab === 'ai' && (
        <section>
          <AIModelSection />
        </section>
      )}

      {activeTab === 'widget' && (
        <section>
          <WidgetSection />
        </section>
      )}

      {activeTab === 'api-keys' && (
        <section>
          <ApiKeysSection />
        </section>
      )}
    </div>
  )
}

function ROISection() {
  const [state, formAction, pending] = useActionState(saveROIConfigAction, null)
  const [editing, setEditing] = useState(false)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900">ROI Assumptions</p>
          <p className="text-xs text-gray-500 mt-0.5">Used to calculate time and money saved on the Analytics page.</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Minutes per ticket
              </label>
              <input
                name="minutesPerTicket"
                type="number"
                min={1}
                max={480}
                defaultValue={10}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">Average staff time to answer one question manually.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Staff hourly rate ($)
              </label>
              <input
                name="staffHourlyRate"
                type="number"
                min={1}
                max={10000}
                defaultValue={50}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">Fully-loaded cost per hour for your support staff.</p>
            </div>
          </div>

          {state && 'error' in state && (
            <p className="text-xs text-red-600">{state.error}</p>
          )}
          {state && 'success' in state && (
            <p className="text-xs text-green-600">Saved.</p>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-gray-500">
          Using defaults (10 min/ticket · $50/hr) unless you set custom values above.
        </p>
      )}
    </div>
  )
}
