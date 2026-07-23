'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ANNUAL_DISCOUNT_PCT, annualMonthlyPrice, type Plan } from '@/lib/billing/plans'

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-brand-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const PLAN_FEATURES: Record<string, string[]> = {
  pro: [
    '500 AI deflections/mo',
    'Knowledge base (URL, docs, GitHub import)',
    'Discord + Slack + GitHub + Telegram + Email',
    'Widget with lead capture',
    'CSV export',
    'Email support',
  ],
  scale: [
    '2,000 AI deflections/mo',
    'Everything in Pro',
    'CSAT scoring',
    'Human escalation routing',
    'Simulation / dry-run mode',
    'Knowledge gap dashboard',
    'Priority support',
  ],
  enterprise: [
    'Unlimited AI deflections',
    'Everything in Scale',
    'Custom AI model config',
    'SLA + dedicated support',
    'Custom invoicing',
  ],
}

export function PricingToggle({ plans }: { plans: Plan[] }) {
  const [annual, setAnnual] = useState(true)

  return (
    <>
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium transition-colors ${!annual ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((v) => !v)}
          className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full transition-colors ${annual ? 'bg-brand-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium transition-colors ${annual ? 'text-gray-900' : 'text-gray-400'}`}>
          Annual
          <span className="ml-1.5 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Save {ANNUAL_DISCOUNT_PCT}%</span>
        </span>
      </div>

      <div className="mt-10 grid sm:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isHighlight = plan.id === 'pro'
          const displayPrice = annual ? annualMonthlyPrice(plan) : plan.priceMonthly
          const features = PLAN_FEATURES[plan.id] ?? []
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-7 flex flex-col ${isHighlight ? 'border-brand-500 bg-brand-50/40 shadow-lg' : 'border-gray-200 bg-white'}`}
            >
              {isHighlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand-600 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow">
                    Most popular
                  </span>
                </div>
              )}
              <div className="text-base font-semibold text-gray-900">{plan.name}</div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold text-gray-900">${(displayPrice / 100).toFixed(0)}</span>
                <span className="text-sm text-gray-500 mb-1.5">/mo</span>
              </div>
              {annual && (
                <div className="mt-1 text-xs text-gray-400">billed annually · ${((displayPrice * 12) / 100).toFixed(0)}/yr</div>
              )}
              <div className="mt-1 text-xs text-brand-600 font-medium">14-day free trial</div>
              <div className="mt-3 text-sm text-gray-500">
                {plan.deflectionsPerMonth === null
                  ? 'Unlimited deflections'
                  : `${plan.deflectionsPerMonth.toLocaleString()} deflections/mo`}
              </div>

              <ul className="mt-6 space-y-2 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-xs text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="#waitlist"
                className={`mt-8 w-full rounded-xl py-2.5 text-center text-xs font-semibold transition-colors ${
                  isHighlight
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Join the waitlist
              </Link>
            </div>
          )
        })}
      </div>
    </>
  )
}
