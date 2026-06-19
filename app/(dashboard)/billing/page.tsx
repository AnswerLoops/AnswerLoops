'use client'

import { useEffect, useState, useTransition } from 'react'
import { ORDERED_PLANS, type Plan } from '@/lib/billing/plans'

interface BillingData {
  planId: string
  status: string
  isTrialing: boolean
  trialEndsAt: string | null
  used: number
  limit: number | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

function daysRemaining(isoDate: string): number {
  const ms = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const days = daysRemaining(trialEndsAt)
  const urgent = days <= 3
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${urgent ? 'border-amber-300 bg-amber-50' : 'border-indigo-200 bg-indigo-50'}`}>
      <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${urgent ? 'bg-amber-500' : 'bg-indigo-500'}`} />
      <div>
        <p className={`text-sm font-semibold ${urgent ? 'text-amber-800' : 'text-indigo-800'}`}>
          {days === 0 ? 'Your trial ends today' : `${days} day${days === 1 ? '' : 's'} left in your trial`}
        </p>
        <p className={`mt-0.5 text-xs ${urgent ? 'text-amber-700' : 'text-indigo-700'}`}>
          Your card will be charged when the trial ends. Cancel anytime before then.
        </p>
      </div>
    </div>
  )
}

function TrialExpiredBanner({ onUpgrade, pending }: { onUpgrade: (planId: string) => void; pending: boolean }) {
  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center space-y-3">
      <p className="text-sm font-semibold text-red-800">Your trial has ended</p>
      <p className="text-xs text-red-700">Choose a plan below to resume AI deflections and full access.</p>
      <button
        onClick={() => onUpgrade('pro')}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {pending ? 'Redirecting…' : 'Start Pro — $49/mo'}
      </button>
    </div>
  )
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
  isTrialing,
  onUpgrade,
  pending,
}: {
  plan: Plan
  current: boolean
  isTrialing: boolean
  onUpgrade: (planId: string) => void
  pending: boolean
}) {
  const label = current && isTrialing ? 'Trialing' : current ? 'Current' : null
  return (
    <div className={`rounded-xl border-2 p-5 transition-all ${current ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
            {label && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
                {label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {plan.deflectionsPerMonth === null ? 'Unlimited deflections/mo' : `${plan.deflectionsPerMonth.toLocaleString()} deflections/mo`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-900">${(plan.priceMonthly / 100).toFixed(0)}</span>
          <span className="text-xs text-gray-500">/mo</span>
        </div>
      </div>
      {!current && (
        <button
          onClick={() => onUpgrade(plan.id)}
          disabled={pending}
          className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {pending ? 'Redirecting…' : `Switch to ${plan.name}`}
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

  const isCanceled = data?.status === 'canceled'
  const isTrialing = data?.isTrialing ?? false

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your plan and usage.</p>
      </div>

      {loading && <div className="text-sm text-gray-400">Loading…</div>}

      {!loading && data && (
        <>
          {/* Trial status banners */}
          {isTrialing && data.trialEndsAt && (
            <TrialBanner trialEndsAt={data.trialEndsAt} />
          )}
          {isCanceled && (
            <TrialExpiredBanner onUpgrade={upgrade} pending={upgradePending} />
          )}

          {/* Usage */}
          {!isCanceled && (
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
          )}

          {/* Plans */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Plans</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ORDERED_PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  current={plan.id === data.planId && !isCanceled}
                  isTrialing={isTrialing}
                  onUpgrade={upgrade}
                  pending={upgradePending}
                />
              ))}
            </div>
          </div>

          {/* Manage */}
          {!isCanceled && (
            <div className="flex items-center gap-3">
              <button
                onClick={openPortal}
                disabled={portalPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                {portalPending ? 'Redirecting…' : 'Manage subscription'}
              </button>
              <span className="text-xs text-gray-400">
                {isTrialing ? 'Cancel trial, update card, or change plan' : 'Change plan, update payment, or cancel'}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  )
}
