'use client'

import { useActionState } from 'react'
import { useState, useEffect } from 'react'
import { updateSLAAction } from '@/app/actions/sla'
import { addRepoAction, removeRepoAction } from '@/app/actions/github'
import { Button } from '@/components/ui/button'
import type { SLAConfig, GitHubRepo } from '@/types'

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

export default function SettingsPage() {
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([])
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [addRepoState, addRepoFormAction, addRepoPending] = useActionState(addRepoAction, null)

  useEffect(() => {
    // Load SLA configs and repos from API
    fetch('/api/tickets?status=open&_config=sla')
    // In a real app these would be dedicated API routes; for now read them client-side
    // We'll fetch from the API routes we created
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

      {/* Environment reminder */}
      <section className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <h2 className="text-xs font-semibold text-amber-800 mb-2">Required Environment Variables</h2>
        <ul className="text-xs text-amber-700 space-y-0.5 font-mono">
          <li>DISCORD_TOKEN=</li>
          <li>DISCORD_CHANNEL_IDS=</li>
          <li>BOT_SECRET=</li>
          <li>OPENAI_API_KEY=</li>
          <li>GITHUB_APP_ID=</li>
          <li>GITHUB_APP_PRIVATE_KEY= (base64 PEM)</li>
          <li>VAPID_PUBLIC_KEY= (optional, for push)</li>
          <li>VAPID_PRIVATE_KEY=</li>
        </ul>
      </section>
    </div>
  )
}
