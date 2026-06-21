'use client'

import { useActionState, useState } from 'react'
import { updateWorkspaceNameAction, completeOnboardingAction } from '@/app/actions/onboarding'
import { saveDiscordIntegrationAction, saveSlackIntegrationAction } from '@/app/actions/integrations'

// ── Icons ─────────────────────────────────────────────────────────────────────

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors'

// ── Step 1 ────────────────────────────────────────────────────────────────────

function NameStep({ onDone, initialName }: { onDone: () => void; initialName: string }) {
  const [state, formAction, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await updateWorkspaceNameAction(prev, fd)
      if (!result?.error) onDone()
      return result
    },
    null
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Name your workspace</h2>
        <p className="mt-1 text-sm text-gray-500">This is how your team will identify this workspace.</p>
      </div>
      <form action={formAction} className="space-y-5">
        <Field label="Workspace name">
          <input name="name" type="text" defaultValue={initialName} placeholder="Acme Community" className={inputCls} required />
        </Field>
        {(state as { error?: string } | null)?.error && (
          <p className="text-xs text-red-500">{(state as { error?: string }).error}</p>
        )}
        <SubmitButton pending={pending} label="Continue" pendingLabel="Saving…" />
      </form>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

type Platform = 'discord' | 'slack' | null

function ConnectStep({ onDone }: { onDone: () => Promise<void> }) {
  const [platform, setPlatform] = useState<Platform>(null)
  const [discordState, discordAction, discordPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveDiscordIntegrationAction(prev, fd)
      if (!result?.error) await onDone()
      return result
    },
    null
  )
  const [slackState, slackAction, slackPending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await saveSlackIntegrationAction(prev, fd)
      if (!result?.error) await onDone()
      return result
    },
    null
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Connect your community</h2>
        <p className="mt-1 text-sm text-gray-500">Choose where your community lives. You can change this later in Settings.</p>
      </div>

      {platform === null && (
        <div className="grid grid-cols-2 gap-3">
          <PlatformCard
            icon={<DiscordIcon className="h-6 w-6 text-[#5865F2]" />}
            label="Discord"
            bg="hover:border-[#5865F2]/40 hover:bg-indigo-50/50"
            onClick={() => setPlatform('discord')}
          />
          <PlatformCard
            icon={<SlackIcon className="h-6 w-6 text-[#4A154B]" />}
            label="Slack"
            bg="hover:border-purple-400/40 hover:bg-purple-50/50"
            onClick={() => setPlatform('slack')}
          />
        </div>
      )}

      {platform === 'discord' && (
        <form action={discordAction} className="space-y-4">
          <BackButton onClick={() => setPlatform(null)} />
          <Field label="Bot Token">
            <input name="botToken" type="password" autoComplete="new-password" placeholder="Bot token from Discord Developer Portal" className={inputCls} required />
          </Field>
          <Field label="Channel IDs (comma-separated)">
            <input name="channelIds" type="text" placeholder="123456789, 987654321" className={inputCls} required />
          </Field>
          {(discordState as { error?: string } | null)?.error && (
            <p className="text-xs text-red-500">{(discordState as { error?: string }).error}</p>
          )}
          <SubmitButton pending={discordPending} label="Connect Discord" pendingLabel="Connecting…" color="discord" />
        </form>
      )}

      {platform === 'slack' && (
        <form action={slackAction} className="space-y-4">
          <BackButton onClick={() => setPlatform(null)} />
          <Field label="Bot Token">
            <input name="botToken" type="password" autoComplete="new-password" placeholder="xoxb-…" className={inputCls} required />
          </Field>
          <Field label="Signing Secret">
            <input name="signingSecret" type="password" autoComplete="new-password" placeholder="From Slack app Basic Information" className={inputCls} required />
          </Field>
          <Field label="Team ID">
            <input name="teamId" type="text" placeholder="T01234ABCDE" className={inputCls} required />
          </Field>
          <Field label="Channel IDs (comma-separated)">
            <input name="channelIds" type="text" placeholder="C01234ABCDE" className={inputCls} required />
          </Field>
          {(slackState as { error?: string } | null)?.error && (
            <p className="text-xs text-red-500">{(slackState as { error?: string }).error}</p>
          )}
          <SubmitButton pending={slackPending} label="Connect Slack" pendingLabel="Connecting…" color="slack" />
        </form>
      )}

      {platform === null && (
        <button type="button" onClick={() => void onDone()} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1">
          Skip for now — connect later in Settings
        </button>
      )}
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export default function OnboardingWizard({ initialName }: { initialName: string }) {
  const [step, setStep] = useState<'name' | 'connect'>('name')
  const stepIndex = step === 'name' ? 0 : 1

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-800">Source Loop</span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-0">
              {['Workspace', 'Connect'].map((label, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                      i < stepIndex
                        ? 'bg-indigo-600 text-white'
                        : i === stepIndex
                        ? 'border-2 border-indigo-600 text-indigo-600 bg-white'
                        : 'border-2 border-gray-200 text-gray-300 bg-white'
                    }`}>
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium ${i === stepIndex ? 'text-indigo-600' : 'text-gray-400'}`}>{label}</span>
                  </div>
                  {i < 1 && (
                    <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${i < stepIndex ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          {step === 'name'    && <NameStep    onDone={() => setStep('connect')} initialName={initialName} />}
          {step === 'connect' && <ConnectStep onDone={completeOnboardingAction} />}
        </div>
      </div>
    </div>
  )
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function PlatformCard({ icon, label, bg, onClick }: { icon: React.ReactNode; label: string; bg: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 p-5 text-sm font-medium text-gray-700 transition-all ${bg} hover:shadow-sm`}
    >
      {icon}
      {label}
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )
}

function SubmitButton({ pending, label, pendingLabel, color }: { pending: boolean; label: string; pendingLabel: string; color?: 'discord' | 'slack' }) {
  const base = 'w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60'
  const colors =
    color === 'discord' ? 'bg-[#5865F2] hover:bg-[#4752c4] text-white' :
    color === 'slack'   ? 'bg-[#4A154B] hover:bg-[#3d1040] text-white' :
                          'bg-indigo-600 hover:bg-indigo-700 text-white'

  return (
    <button type="submit" disabled={pending} className={`${base} ${colors}`}>
      {pending ? pendingLabel : label}
    </button>
  )
}
