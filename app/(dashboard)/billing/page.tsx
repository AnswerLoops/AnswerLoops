'use client'

import { useEffect, useState, useTransition } from 'react'
import { ORDERED_PLANS, type Plan } from '@/lib/billing/plans'

interface BillingData {
  planId: string
  status: string
  used: number
  limit: number | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{used.toLocaleString()}</span> deflections this month &mdash; <span className="text-indigo-600">unlimited</span>
      </div>
    )
  }
  const pct = Math.min((used / limit) * 100, 100)
  const over = used >= limit
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          <span className={`font-semibold ${over ? 'text-red-600' : 'text-gray-900'}`}>{used.toLocaleString()}</span>
          {' / '}{limit.toLocaleString()} deflections this month
        </span>
        {over && <span className="text-xs font-medium text-red-600">Limit reached</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  current,
  onUpgrade,
  pending,
}: {
  plan: Plan
  current: boolean
  onUpgrade: (planId: string) => void
  pending: boolean
}) {
  const free = plan.priceMonthly === 0
  return (
    <div className={`rounded-xl border-2 p-5 transition-all ${current ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
            {current && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">Current</span>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {plan.deflectionsPerMonth === null ? 'Unlimited deflections/mo' : `${plan.deflectionsPerMonth.toLocaleString()} deflections/mo`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-900">
            {free ? 'Free' : `$${(plan.priceMonthly / 100).toFixed(0)}`}
          </span>
          {!free && <span className="text-xs text-gray-500">/mo</span>}
        </div>
      </div>
      {!current && !free && (
        <button
          onClick={() => onUpgrade(plan.id)}
          disabled={pending}
          className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {pending ? 'Redirecting…' : `Upgrade to ${plan.name}`}
        </button>
      )}
    </div>
  )
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgradePending, startUpgrade] = useTransition()
  const [portalPending, startPortal] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((d) => { setData(d as BillingData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function upgrade(planId: string) {
    startUpgrade(async () => {
      setError(null)
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const { url, error: err } = await r.json() as { url?: string; error?: string }
      if (err) { setError(err); return }
      if (url) window.location.href = url
    })
  }

  function openPortal() {
    startPortal(async () => {
      setError(null)
      const r = await fetch('/api/billing/portal', { method: 'POST' })
      const { url, error: err } = await r.json() as { url?: string; error?: string }
      if (err) { setError(err); return }
      if (url) window.location.href = url
    })
  }

  const currentPlan = ORDERED_PLANS.find((p) => p.id === data?.planId) ?? ORDERED_PLANS[0]
  const upgradablePlans = ORDERED_PLANS.filter(
    (p) => p.priceMonthly > (currentPlan?.priceMonthly ?? 0)
  )

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your plan and usage.</p>
      </div>

      {loading && <div className="text-sm text-gray-400">Loading…</div>}

      {!loading && data && (
        <>
          {/* Usage */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Usage this month</h2>
              {data.cancelAtPeriodEnd && data.currentPeriodEnd && (
                <span className="text-xs text-amber-600 font-medium">
                  Cancels {new Date(data.currentPeriodEnd).toLocaleDateString()}
                </span>
              )}
              {data.status === 'past_due' && (
                <span className="text-xs text-red-600 font-medium">Payment past due</span>
              )}
            </div>
            <UsageBar used={data.used} limit={data.limit} />
            {data.used >= (data.limit ?? Infinity) && (
              <p className="text-xs text-red-600">
                Auto-deflection paused — upgrade to resume automatic answers.
              </p>
            )}
          </div>

          {/* Plans */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Plans</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ORDERED_PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  current={plan.id === data.planId}
                  onUpgrade={upgrade}
                  pending={upgradePending}
                />
              ))}
            </div>
          </div>

          {/* Manage */}
          {data.planId !== 'hobby' && (
            <div className="flex items-center gap-3">
              <button
                onClick={openPortal}
                disabled={portalPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                {portalPending ? 'Redirecting…' : 'Manage subscription'}
              </button>
              <span className="text-xs text-gray-400">Change plan, update payment, or cancel</span>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}

      {/* Upgrade nudge for hobby users near/at limit */}
      {!loading && data && data.planId === 'hobby' && upgradablePlans.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Free plan:</strong> {data.limit} deflections/month. Upgrade to Pro for 500/month and unlock higher auto-deflection rates.
        </div>
      )}
    </div>
  )
}
