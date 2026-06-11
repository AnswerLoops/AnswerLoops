'use client'

import { useActionState, useState } from 'react'
import { updateWorkspaceNameAction, completeOnboardingAction } from '@/app/actions/onboarding'
import { saveDiscordIntegrationAction, saveSlackIntegrationAction } from '@/app/actions/integrations'
import { Button } from '@/components/ui/button'

// ── Step 1: name the workspace ────────────────────────────────────────────────

function NameStep({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await updateWorkspaceNameAction(prev, fd)
      if (!result?.error) onDone()
      return result
    },
    null
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Name your workspace</h2>
        <p className="mt-1 text-sm text-gray-500">
          This is how your team will identify this workspace.
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Workspace name</label>
          <input
            name="name"
            type="text"
            defaultValue="My Workspace"
            placeholder="Acme Community"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
            required
          />
        </div>
        {(state as { error?: string } | null)?.error && (
          <p className="text-xs text-red-600">{(state as { error?: string }).error}</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </div>
  )
}

// ── Step 2: connect integration ───────────────────────────────────────────────

type Platform = 'discord' | 'slack' | null

function ConnectStep({ onDone }: { onDone: () => void }) {
  const [platform, setPlatform] = useState<Platform>(null)
  const [discordState, discordAction, discordPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveDiscordIntegrationAction(prev, fd)
      if (!result?.error) onDone()
      return result
    },
    null
  )
  const [slackState, slackAction, slackPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveSlackIntegrationAction(prev, fd)
      if (!result?.error) onDone()
      return result
    },
    null
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Connect your community</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose where your community lives. You can add or change this later in Settings.
        </p>
      </div>

      {platform === null && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPlatform('discord')}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
          >
            <span className="text-2xl">💬</span>
            Discord
          </button>
          <button
            onClick={() => setPlatform('slack')}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-4 text-sm font-medium text-gray-700 hover:border-purple-400 hover:bg-purple-50 transition-colors"
          >
            <span className="text-2xl">🔧</span>
            Slack
          </button>
        </div>
      )}

      {platform === 'discord' && (
        <form action={discordAction} className="space-y-3">
          <button
            type="button"
            onClick={() => setPlatform(null)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Discord Bot Token</label>
            <input
              name="botToken"
              type="password"
              placeholder="Bot token from Discord Developer Portal"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Channel IDs (comma-separated)</label>
            <input
              name="channelIds"
              type="text"
              placeholder="123456789, 987654321"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
          </div>
          {(discordState as { error?: string } | null)?.error && (
            <p className="text-xs text-red-600">{(discordState as { error?: string }).error}</p>
          )}
          <Button type="submit" disabled={discordPending}>
            {discordPending ? 'Connecting…' : 'Connect Discord'}
          </Button>
        </form>
      )}

      {platform === 'slack' && (
        <form action={slackAction} className="space-y-3">
          <button
            type="button"
            onClick={() => setPlatform(null)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
            <input
              name="botToken"
              type="password"
              placeholder="xoxb-…"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Signing Secret</label>
            <input
              name="signingSecret"
              type="password"
              placeholder="From Slack app Basic Information"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Team ID</label>
            <input
              name="teamId"
              type="text"
              placeholder="T01234ABCDE"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Channel IDs (comma-separated)</label>
            <input
              name="channelIds"
              type="text"
              placeholder="C01234ABCDE"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm font-mono"
              required
            />
          </div>
          {(slackState as { error?: string } | null)?.error && (
            <p className="text-xs text-red-600">{(slackState as { error?: string }).error}</p>
          )}
          <Button type="submit" disabled={slackPending}>
            {slackPending ? 'Connecting…' : 'Connect Slack'}
          </Button>
        </form>
      )}

      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={onDone}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Skip for now — I'll connect later in Settings
        </button>
      </div>
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState<'name' | 'connect' | 'done'>('name')
  const [, completeAction, completePending] = useActionState(
    async () => {
      await completeOnboardingAction()
    },
    undefined
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <span className="text-sm font-bold text-indigo-600 tracking-tight">Community Platform</span>
          <div className="mt-3 flex items-center gap-2">
            <StepDot active={step === 'name'} done={step !== 'name'} label="1" />
            <div className="h-px flex-1 bg-gray-200" />
            <StepDot active={step === 'connect'} done={step === 'done'} label="2" />
            <div className="h-px flex-1 bg-gray-200" />
            <StepDot active={step === 'done'} done={false} label="3" />
          </div>
        </div>

        {step === 'name' && <NameStep onDone={() => setStep('connect')} />}

        {step === 'connect' && <ConnectStep onDone={() => setStep('done')} />}

        {step === 'done' && (
          <div className="space-y-5 text-center">
            <div className="text-4xl">🎉</div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">You're all set</h2>
              <p className="mt-1 text-sm text-gray-500">
                Your workspace is ready. Head to the dashboard to get started.
              </p>
            </div>
            <form action={completeAction}>
              <Button type="submit" disabled={completePending}>
                {completePending ? 'Loading…' : 'Go to dashboard'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
        done
          ? 'bg-indigo-600 text-white'
          : active
          ? 'border-2 border-indigo-600 text-indigo-600'
          : 'border-2 border-gray-200 text-gray-400'
      }`}
    >
      {done ? '✓' : label}
    </div>
  )
}
