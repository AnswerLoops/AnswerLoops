'use client'

import { useState } from 'react'
import type { SimulationResult, SimTicketResult } from '@/app/api/simulation/run/route'

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

export default function SimulationPage() {
  const [count, setCount] = useState(20)
  const [model, setModel] = useState('gpt-4o')
  const [threshold, setThreshold] = useState(0.8)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, model, threshold }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const conf = (n: number) => (
    <span className={n >= 0.8 ? 'text-green-400' : n >= 0.5 ? 'text-yellow-400' : 'text-red-400'}>
      {(n * 100).toFixed(0)}%
    </span>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Simulation Mode</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Replay historical tickets through the AI pipeline — no writes, no messages sent.
          Compare what the AI <em>would</em> do against what actually happened.
        </p>
      </div>

      {/* Config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tickets to replay</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Deflect threshold ({threshold})
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
        >
          {running ? 'Running simulation…' : 'Run simulation'}
        </button>
        {running && (
          <p className="text-xs text-gray-500">
            Processing up to {count} tickets — this may take a minute.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Tickets', value: result.summary.total },
              { label: 'Would deflect', value: pct(result.summary.deflectRate) },
              { label: 'Actually deflected', value: pct(result.summary.actualDeflectRate) },
              { label: 'Match rate', value: pct(result.summary.matchRate) },
              { label: 'Avg confidence', value: pct(result.summary.avgConfidence) },
              { label: 'Avg time', value: `${(result.summary.avgDurationMs / 1000).toFixed(1)}s` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Delta callout */}
          {(() => {
            const delta = result.summary.deflectRate - result.summary.actualDeflectRate
            const color = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
            const label = delta > 0
              ? `This model/threshold combo would deflect ${pct(Math.abs(delta))} more tickets than production.`
              : delta < 0
              ? `This model/threshold combo would deflect ${pct(Math.abs(delta))} fewer tickets than production.`
              : 'Deflect rate matches production exactly.'
            return (
              <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm ${color}`}>
                {label}
              </div>
            )
          })()}

          {/* Per-ticket results */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300">Per-ticket results</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-800">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Question</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-center">Confidence</th>
                    <th className="px-4 py-2 text-center">Sim deflect</th>
                    <th className="px-4 py-2 text-center">Actual</th>
                    <th className="px-4 py-2 text-center">Match</th>
                    <th className="px-4 py-2 text-left">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {result.results.map((r: SimTicketResult) => (
                    <tr key={r.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-500">#{r.id}</td>
                      <td className="px-4 py-3 text-gray-300 max-w-xs">
                        <div className="truncate">{r.content}</div>
                        <details className="mt-1">
                          <summary className="text-xs text-brand-400 cursor-pointer">Sim answer</summary>
                          <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{r.simAnswer}</div>
                        </details>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{r.category ?? '—'}</td>
                      <td className="px-4 py-3 text-center">{conf(r.simConfidence)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={r.simWouldDeflect ? 'text-green-400' : 'text-gray-500'}>
                          {r.simWouldDeflect ? 'Auto' : 'Human'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={r.actualWouldDeflect ? 'text-green-400' : 'text-gray-500'}>
                          {r.actualWouldDeflect ? 'Auto' : 'Human'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.match
                          ? <span className="text-green-400">✓</span>
                          : <span className="text-red-400">✗</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                        <div className="truncate">{r.simReasoning}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
