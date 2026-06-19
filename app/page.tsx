import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { ORDERED_PLANS } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-gray-900">Community Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="#pricing" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Pricing</Link>
          <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            Get started free
          </Link>
        </div>
      </div>
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 mb-6">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        14-day free trial — no charge until trial ends
      </div>
      <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
        Your community&rsquo;s repeat questions,
        <br />
        <span className="text-indigo-600">answered automatically.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 leading-relaxed">
        Connect Discord or Slack. The platform triages every question with AI, drafts an answer grounded in your own resolved tickets and docs, and auto-posts high-confidence replies — so your team only handles the hard 10%.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href="/login"
          className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Start free trial
        </Link>
        <Link
          href="#how-it-works"
          className="rounded-xl border border-gray-200 px-8 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          See how it works
        </Link>
      </div>
      <p className="mt-4 text-xs text-gray-400">14-day trial, card required. Cancel anytime. Sign in with GitHub, Discord, or Google.</p>
    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function Stats() {
  const items = [
    { stat: '< 5 min', label: 'from signup to first auto-answer' },
    { stat: '80%+', label: 'deflection rate after 30 days' },
    { stat: '6 LLMs', label: 'supported — bring your own key' },
    { stat: '0 lock-in', label: 'self-hosted or any cloud' },
  ]
  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        {items.map((item) => (
          <div key={item.stat} className="text-center">
            <div className="text-3xl font-bold text-indigo-600">{item.stat}</div>
            <div className="mt-1 text-sm text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Connect your community',
      body: 'Paste your Discord bot token or Slack credentials. The platform starts ingesting questions immediately — no code required.',
    },
    {
      n: '2',
      title: 'AI triages and answers',
      body: "Every question is classified, embedded, and matched against prior resolved answers and your knowledge base. The agent drafts a grounded reply using your team's own words.",
    },
    {
      n: '3',
      title: 'High confidence → auto-posted',
      body: 'A reviewer model grades each answer. High-confidence, fully-answered replies post automatically. Everything else queues for a human with a ready-to-edit draft.',
    },
    {
      n: '4',
      title: 'Gets better every month',
      body: '👍/👎 feedback from the community prunes bad answers. Resolved tickets promote into a searchable KB. The deflection rate climbs without anyone retraining anything.',
    },
  ]
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-gray-900">From first question to self-improving KB</h2>
        <p className="mt-3 text-gray-500">The whole pipeline ships on day one — nothing to assemble.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
              {s.n}
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">{s.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    { icon: '🔁', title: 'Compounding loop', body: 'More questions → more resolved answers → bigger KB → sharper retrieval → more auto-deflected. Value increases every month.' },
    { icon: '🔒', title: 'Confidence gate', body: "A separate reviewer model grades every answer. Only high-confidence, fully-answered replies post automatically. The bot knows what it doesn't know." },
    { icon: '🤖', title: 'Bring your own LLM', body: 'OpenAI, Anthropic, Google, Groq, Mistral, or any OpenAI-compatible endpoint including local models. No platform AI bill.' },
    { icon: '📊', title: 'ROI visible from day one', body: 'Deflection rate, trend, hours saved, per-category accuracy — all live. Turns ticket data into a number a budget owner can sign off on.' },
    { icon: '🌐', title: 'Embeddable widget', body: 'The same self-improving KB available on any website via a <script> tag. One platform, every channel.' },
    { icon: '🏠', title: 'Self-host or cloud', body: 'Multi-stage Docker image, docker-compose.prod.yml included. Run on Railway, Fly.io, or your own infra. No vendor lock-in.' },
  ]
  return (
    <section className="bg-gray-50 border-y border-gray-100">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Everything you need, nothing you don&rsquo;t</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-5xl px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-gray-900">Pay for deflections, not seats</h2>
        <p className="mt-3 text-gray-500">Price tracks value delivered. Every plan starts with a 14-day free trial.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-5">
        {ORDERED_PLANS.map((plan) => {
          const isHighlight = plan.id === 'pro'
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-6 flex flex-col ${isHighlight ? 'border-indigo-500 bg-indigo-50/40 shadow-md' : 'border-gray-200 bg-white'}`}
            >
              {isHighlight && (
                <div className="mb-3">
                  <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Most popular</span>
                </div>
              )}
              <div className="text-sm font-semibold text-gray-900">{plan.name}</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-bold text-gray-900">${plan.priceMonthly / 100}</span>
                <span className="text-sm text-gray-500 mb-1">/mo</span>
              </div>
              <div className="mt-1 text-xs text-indigo-600 font-medium">14-day free trial</div>
              <div className="mt-2 text-sm text-gray-500">
                {plan.deflectionsPerMonth === null
                  ? 'Unlimited deflections'
                  : `${plan.deflectionsPerMonth.toLocaleString()} deflections/mo`}
              </div>
              <div className="flex-1" />
              <Link
                href="/login"
                className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                  isHighlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Start free trial
              </Link>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-center text-sm text-gray-400">
        All plans include Discord + Slack ingest, AI agent, knowledge base, analytics, embeddable widget, and email alerts.
        Card required at signup. Cancel anytime before trial ends and you won&apos;t be charged.
      </p>
    </section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="bg-indigo-600">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white">Your community deserves better than copy-paste answers.</h2>
        <p className="mt-4 text-indigo-200 text-lg">Sign up in 30 seconds. First auto-answer in under 5 minutes.</p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl bg-white px-10 py-3.5 text-base font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
        >
          Start free trial
        </Link>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600">
            <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
            </svg>
          </div>
          Community Platform
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href="#pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
          <Link href="/login" className="hover:text-gray-600 transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <Stats />
      <HowItWorks />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
