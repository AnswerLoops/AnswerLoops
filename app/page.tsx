import Link from 'next/link'
import { auth } from '@/auth'
import { ORDERED_PLANS } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

const GITHUB_URL = 'https://github.com/NathanTarbert/community-platform'

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-gray-900">Source Loop</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </Link>
          <Link href="#pricing" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Pricing</Link>
          {loggedIn ? (
            <Link href="/dashboard" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Go to dashboard →
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Start free trial
            </Link>
          )}
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
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
        </svg>
        Open source · AGPL-3.0 · Self-host free
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
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-8 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
          Self-host free
        </Link>
      </div>
      <p className="mt-4 text-xs text-gray-400">14-day trial, card required. Or clone the repo and run it on your own infra — forever free.</p>
    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function Stats() {
  const items = [
    { stat: 'AGPL-3.0', label: 'open source license' },
    { stat: '80%+', label: 'deflection rate after 30 days' },
    { stat: '6 LLMs', label: 'supported — bring your own key' },
    { stat: '1 command', label: 'docker compose up — self-hosted' },
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
    { icon: '🏠', title: 'Your data, your infra', body: 'AGPL-3.0 licensed. Clone the repo, run docker compose up, and your data never leaves your infrastructure. No vendor lock-in, ever.' },
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

// ── Self-host callout ─────────────────────────────────────────────────────────

function SelfHostCallout() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-10 flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 mb-4">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Open source · AGPL-3.0
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Run it on your own infra. Free, forever.</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">
            Clone the repo, add your env vars, and run one command. Your community data stays on your servers — not ours. Privacy-first teams, fintech, and regulated industries choose this path.
          </p>
          <div className="bg-gray-950 rounded-xl px-5 py-4 font-mono text-sm text-green-400">
            docker compose -f docker-compose.prod.yml up --build -d
          </div>
        </div>
        <div className="flex flex-col gap-3 md:min-w-[180px]">
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            View on GitHub
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Use hosted instead
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50 border-y border-gray-100">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Hosted plans — or self-host free</h2>
          <p className="mt-3 text-gray-500">All hosted plans start with a 14-day free trial. Prefer full control? Self-host is always free.</p>
        </div>

        {/* Self-host tier */}
        <div className="mb-4 rounded-2xl border-2 border-gray-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">Self-hosted</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">AGPL-3.0</span>
            </div>
            <p className="text-xs text-gray-500">Full source code. Run on your infra. Your data never leaves your servers.</p>
          </div>
          <div className="flex items-end gap-1 shrink-0">
            <span className="text-3xl font-bold text-gray-900">Free</span>
            <span className="text-sm text-gray-500 mb-1">forever</span>
          </div>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Clone on GitHub
          </Link>
        </div>

        {/* Hosted plans */}
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
          All hosted plans include Discord + Slack ingest, AI agent, knowledge base, analytics, embeddable widget, and email alerts.
          Card required at signup. Cancel anytime before trial ends and you won&apos;t be charged.
        </p>
      </div>
    </section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="bg-indigo-600">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white">Your community deserves better than copy-paste answers.</h2>
        <p className="mt-4 text-indigo-200 text-lg">Use our cloud or run it on your own infra. Either way, your community data stays yours.</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-white px-10 py-3.5 text-base font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
          >
            Start free trial
          </Link>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-indigo-400 px-10 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Self-host free
          </Link>
        </div>
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
          Source Loop · AGPL-3.0
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">GitHub</Link>
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

  return (
    <div className="min-h-screen bg-white">
      <Nav loggedIn={!!session?.user} />
      <Hero />
      <Stats />
      <HowItWorks />
      <Features />
      <SelfHostCallout />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
