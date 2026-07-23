import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/auth'
import { ORDERED_PLANS } from '@/lib/billing/plans'
import { Nav, Footer, GithubIcon, GITHUB_URL } from '@/components/marketing/chrome'
import { PricingToggle } from '@/components/marketing/pricing-toggle'
import { PricingComparisonTable } from '@/components/marketing/pricing-comparison-table'
import { WaitlistForm } from '@/components/waitlist-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing — AnswerLoops',
  description: 'Simple, deflection-based pricing for AnswerLoops. Self-host it yourself, or choose a hosted plan with a 14-day free trial. Save 20% billed annually.',
}

const PRICING_FAQ = [
  {
    q: 'What counts as a deflection?',
    a: 'A deflection is one question the AI answered automatically with high enough confidence that no human needed to step in. Questions routed to a human for review — even if the AI drafted a suggested reply — don\'t count.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes, any time from Settings → Billing. Upgrades apply immediately; downgrades take effect at the end of your current billing period so you keep what you already paid for.',
  },
  {
    q: 'What happens if I go over my deflection limit?',
    a: 'You\'ll see a warning banner in the dashboard once you cross 80% of your monthly limit. If you hit the limit, AI auto-answering pauses and new questions route to your human queue instead — nothing breaks, and no surprise charges hit your card.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Every hosted plan starts with a 14-day free trial, card required at signup. Cancel any time before the trial ends and you won\'t be charged.',
  },
  {
    q: 'Is there a free, self-hosted option?',
    a: 'Yes. The core platform is open source — clone the repo and run docker compose up on your own infrastructure, with your data never leaving your servers. License details are on GitHub.',
  },
  {
    q: 'Do I need to provide my own AI provider key?',
    a: 'Yes, on every hosted plan. You bring your own key for OpenAI, Anthropic, Google Gemini, Groq, Mistral, or any OpenAI-compatible endpoint (including local models via Ollama). There\'s no platform AI markup — you pay your provider directly, and switching providers never means switching plans.',
  },
] as const

export default async function PricingPage() {
  const session = await auth()

  return (
    <div className="min-h-screen bg-white">
      <Nav loggedIn={!!session?.user} />

      <section className="bg-ink-950 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 mb-6">
            Pricing
          </span>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">Simple pricing that scales with you</h1>
          <p className="mt-5 text-lg text-white/60 max-w-2xl mx-auto">
            Deflection-based tiers, not per-seat. Every hosted plan starts with a 14-day free trial. Prefer full control? You can also self-host it yourself.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          {/* Self-host row */}
          <div className="mb-10 rounded-2xl border-2 border-gray-200 bg-gray-50 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">Self-hosted</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Open source</span>
              </div>
              <p className="text-xs text-gray-500">Full source code. Run on your infra. Your data never leaves your servers.</p>
            </div>
            <div className="flex items-end gap-1 shrink-0">
              <span className="text-3xl font-bold text-gray-900">Self-hosted</span>
            </div>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <GithubIcon />
              View on GitHub
            </Link>
          </div>

          <PricingToggle plans={ORDERED_PLANS} />

          <p className="mt-8 text-center text-sm text-gray-400">
            All hosted plans include Discord + Slack + GitHub + Telegram + Email ingest, the AI agent, knowledge base, analytics, and the embeddable widget.
            Card required at signup. Cancel anytime before the trial ends and you won&apos;t be charged.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-200 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Compare plans</h2>
            <p className="mt-2 text-sm text-gray-500">Every plan includes the full AI pipeline — higher tiers add scale, insight, and support.</p>
          </div>
          <PricingComparisonTable />
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Pricing questions</h2>
          </div>
          <div className="flex flex-col gap-4">
            {PRICING_FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" className="bg-black">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-white">Be first in line when we open the doors.</h2>
          <p className="mt-4 text-gray-400 text-lg max-w-xl mx-auto">Join the waitlist and we&apos;ll email you the moment hosted plans go live.</p>
          <div className="mt-10 mx-auto max-w-lg">
            <WaitlistForm dark />
            <p className="mt-3 text-xs text-slate-500">No spam. Unsubscribe any time.</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
