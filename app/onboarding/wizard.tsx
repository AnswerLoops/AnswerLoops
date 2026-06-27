'use client'

import { useActionState, useCallback, useRef, useState } from 'react'
import { updateWorkspaceNameAction, completeOnboardingAction } from '@/app/actions/onboarding'
import { saveDiscordIntegrationAction, saveSlackIntegrationAction } from '@/app/actions/integrations'
import { ingestUrlAction } from '@/app/actions/ingest-url'
import type { IngestUrlResult } from '@/app/actions/ingest-url'

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

// ── Shared UI ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors'

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Step 1: Name ───────────────────────────────────────────────────────────────

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

// ── Step 2: Connect ────────────────────────────────────────────────────────────

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
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs text-blue-700 space-y-1">
            <p className="font-medium">Discord setup — 2 minutes</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
              <li>Go to <span className="font-mono">discord.com/developers</span> → New Application → Bot tab → Reset Token</li>
              <li>Enable <strong>Message Content Intent</strong> under Privileged Gateway Intents</li>
              <li>OAuth2 → URL Generator → scope <code>bot</code> → Send Messages + Read Message History → invite bot to your server</li>
              <li>Right-click the channel → Copy Channel ID (enable Developer Mode in Discord settings first)</li>
            </ol>
          </div>
          <Field label="Bot Token">
            <input name="botToken" type="password" autoComplete="new-password" placeholder="Bot token from Discord Developer Portal" className={inputCls} required />
          </Field>
          <Field label="Channel IDs" hint="Paste channel IDs to monitor, comma-separated. Right-click channel → Copy Channel ID.">
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
          <Field label="Channel IDs" hint="Comma-separated Slack channel IDs (e.g. C01234ABCDE).">
            <input name="channelIds" type="text" placeholder="C01234ABCDE" className={inputCls} required />
          </Field>
          {(slackState as { error?: string } | null)?.error && (
            <p className="text-xs text-red-500">{(slackState as { error?: string }).error}</p>
          )}
          <SubmitButton pending={slackPending} label="Connect Slack" pendingLabel="Connecting…" color="slack" />
        </form>
      )}

      {platform === null && (
        <button type="button" onClick={onDone} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1">
          Skip for now — connect later in Settings
        </button>
      )}
    </div>
  )
}

// ── Step 3: Seed KB ────────────────────────────────────────────────────────────

type SeedMode = 'choose' | 'file' | 'url'

function SeedStep({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<SeedMode>('choose')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ error?: string; created?: number; filename?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [urlResult, urlAction, urlPending] = useActionState<IngestUrlResult, FormData>(
    async (prev, fd) => {
      const r = await ingestUrlAction(prev, fd)
      if (!r.error) onDone()
      return r
    },
    {}
  )

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setUploadResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/kb/upload', { method: 'POST', body: fd })
      const data = await res.json() as { error?: string; created?: number; filename?: string }
      setUploadResult(data)
      if (!data.error) setTimeout(onDone, 1200)
    } catch {
      setUploadResult({ error: 'Upload failed. Try again.' })
    } finally {
      setUploading(false)
    }
  }, [onDone])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Seed your knowledge base</h2>
        <p className="mt-1 text-sm text-gray-500">
          Give the bot something to work from before any tickets arrive. Upload existing docs or crawl your docs site.
        </p>
      </div>

      {mode === 'choose' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('file')}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-gray-200 p-5 text-sm font-medium text-gray-700 transition-all hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-sm"
            >
              <svg className="h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 16V8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Upload file
              <span className="text-[10px] font-normal text-gray-400">PDF · DOCX · MD · TXT · CSV</span>
            </button>
            <button
              onClick={() => setMode('url')}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-gray-200 p-5 text-sm font-medium text-gray-700 transition-all hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-sm"
            >
              <svg className="h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Crawl a URL
              <span className="text-[10px] font-normal text-gray-400">Docs site · Wiki · Blog</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1"
          >
            Skip for now — add content later in the KB page
          </button>
        </div>
      )}

      {mode === 'file' && (
        <div className="space-y-4">
          <BackButton onClick={() => setMode('choose')} />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
              uploading ? 'pointer-events-none opacity-60 border-gray-200' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.md,.txt,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
            />
            {uploading ? (
              <>
                <svg className="h-6 w-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-medium text-indigo-700">Parsing and embedding…</p>
                <p className="text-xs text-indigo-500">May take 15–60 s for large files.</p>
              </>
            ) : uploadResult?.created != null ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckIcon className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-700">{uploadResult.created} chunks added from {uploadResult.filename}</p>
                <p className="text-xs text-green-500">Continuing…</p>
              </>
            ) : (
              <>
                <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 16V8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-sm text-gray-600"><span className="font-medium text-indigo-600">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-400">PDF · DOCX · MD · TXT · CSV up to 50 MB</p>
              </>
            )}
          </div>
          {uploadResult?.error && <p className="text-xs text-red-500">{uploadResult.error}</p>}
        </div>
      )}

      {mode === 'url' && (
        <div className="space-y-4">
          <BackButton onClick={() => setMode('choose')} />
          <form action={urlAction} className="space-y-4">
            <input type="hidden" name="mode" value="page" />
            <Field label="Docs URL" hint="Paste a public docs page or site root. We'll crawl and embed the content.">
              <input
                name="url"
                type="url"
                required
                disabled={urlPending}
                placeholder="https://docs.yourproduct.com"
                className={inputCls}
              />
            </Field>
            {urlPending && (
              <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3.5 py-3">
                <svg className="h-4 w-4 animate-spin text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-xs font-medium text-indigo-700">Crawling and embedding — this can take up to 60 s…</p>
              </div>
            )}
            {urlResult.error && <p className="text-xs text-red-500">{urlResult.error}</p>}
            {urlResult.created != null && !urlResult.error && (
              <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3.5 py-3">
                <CheckIcon className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs font-medium text-green-700">
                  {urlResult.pages != null
                    ? `${urlResult.created} articles from ${urlResult.pages} pages added.`
                    : `${urlResult.created} articles added.`}
                </p>
              </div>
            )}
            <SubmitButton pending={urlPending} label="Import URL" pendingLabel="Importing…" />
          </form>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Done ───────────────────────────────────────────────────────────────

function DoneStep({ completedSteps }: { completedSteps: Set<string> }) {
  const [loading, setLoading] = useState(false)

  async function handleFinish() {
    setLoading(true)
    await completeOnboardingAction()
  }

  const items = [
    { key: 'name',    label: 'Workspace named' },
    { key: 'connect', label: 'Community connected' },
    { key: 'seed',    label: 'Knowledge base seeded' },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckIcon className="h-7 w-7 text-green-600" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">You're all set!</h2>
        <p className="text-sm text-gray-500">Your workspace is ready. Here's what was completed:</p>
      </div>

      <ul className="space-y-2.5">
        {items.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${completedSteps.has(key) ? 'bg-green-100' : 'bg-gray-100'}`}>
              {completedSteps.has(key)
                ? <CheckIcon className="h-3 w-3 text-green-600" />
                : <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              }
            </div>
            <span className={`text-sm ${completedSteps.has(key) ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
            {!completedSteps.has(key) && (
              <span className="text-xs text-gray-300">— skipped</span>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2 text-xs text-gray-500">
        <p className="font-medium text-gray-700 text-sm">What's next</p>
        <ul className="space-y-1">
          <li>• Post a message in your connected channel → it appears as a ticket at <strong>/tickets</strong></li>
          <li>• The AI will draft an answer automatically and route low-confidence ones to you</li>
          <li>• Add more content to the KB at <strong>/kb</strong> any time</li>
          <li>• Fine-tune AI model, SLA, and channels in <strong>Settings</strong></li>
        </ul>
      </div>

      <button
        onClick={handleFinish}
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-all disabled:opacity-60"
      >
        {loading ? 'Loading dashboard…' : 'Go to dashboard →'}
      </button>
    </div>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────────

type Step = 'name' | 'connect' | 'seed' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'name',    label: 'Workspace' },
  { key: 'connect', label: 'Connect' },
  { key: 'seed',    label: 'Seed KB' },
  { key: 'done',    label: 'Go live' },
]

export default function OnboardingWizard({ initialName }: { initialName: string }) {
  const [step, setStep] = useState<Step>('name')
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  function advance(from: Step) {
    setCompleted((prev) => new Set([...prev, from]))
    const next = STEPS[STEPS.findIndex((s) => s.key === from) + 1]
    if (next) setStep(next.key)
  }

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
              <span className="text-sm font-semibold text-gray-800">AnswerLoops</span>
            </div>

            {/* Progress stepper */}
            <div className="flex items-center gap-0">
              {STEPS.map(({ key, label }, i) => (
                <div key={key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                      i < stepIndex
                        ? 'bg-indigo-600 text-white'
                        : i === stepIndex
                        ? 'border-2 border-indigo-600 text-indigo-600 bg-white'
                        : 'border-2 border-gray-200 text-gray-300 bg-white'
                    }`}>
                      {i < stepIndex ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${i === stepIndex ? 'text-indigo-600' : 'text-gray-400'}`}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1.5 mb-4 transition-colors ${i < stepIndex ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          {step === 'name'    && <NameStep    initialName={initialName} onDone={() => advance('name')} />}
          {step === 'connect' && <ConnectStep onDone={() => advance('connect')} />}
          {step === 'seed'    && <SeedStep    onDone={() => advance('seed')} />}
          {step === 'done'    && <DoneStep    completedSteps={completed} />}
        </div>
      </div>
    </div>
  )
}
