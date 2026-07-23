import Link from 'next/link'
import { auth } from '@/auth'
import { ORDERED_PLANS } from '@/lib/billing/plans'
import { AnimatedChat } from '@/components/animated-chat'
import { WaitlistForm } from '@/components/waitlist-form'
import { Nav, Footer, GithubIcon, GITHUB_URL } from '@/components/marketing/chrome'

export const dynamic = 'force-dynamic'

// ── Hero ──────────────────────────────────────────────────────────────────────

const HERO_PILLS = [
  {
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
      </svg>
    ),
    label: 'Connect in minutes',
  },
  {
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    label: 'Trained on your docs & tickets',
  },
  {
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    label: 'Auto-answers when confident',
  },
  {
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 10-4-4 4 4 0 004 4zm6 4a4 4 0 10-4-4" />
      </svg>
    ),
    label: 'Escalates what it\'s unsure about',
  },
]

function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(29,78,216,0.3),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(49,46,129,0.4),_transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%222%22 cy=%222%22 r=%221%22 fill=%22%23eff6ff%22/></svg>')]" />
      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="text-center animate-[softRise_0.5s_ease-out]">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80">
            <span aria-hidden>✨</span>
            AI agents that work where your devs are
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            <span className="text-white">AI agents for your</span>
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-indigo-400 bg-clip-text text-transparent">
              developer community
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/60 leading-relaxed">
            Connect Discord or Slack. AnswerLoops triages every question with AI, answers from your own docs and resolved tickets, and auto-posts replies when it&apos;s confident — so your team only sees the questions it isn&apos;t sure about.
          </p>
          <div className="mt-8 mx-auto max-w-lg">
            <WaitlistForm dark />
            <p className="mt-3 text-xs text-white/40 text-center">Be first to know when we launch. No spam.</p>
            <p className="mt-2 text-xs text-center">
              <Link href="/pricing" className="text-white/50 hover:text-white/80 transition-colors">
                Try it free for 14 days →
              </Link>
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {HERO_PILLS.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-sm text-white/50">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-brand-400">{p.icon}</span>
                {p.label}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 mx-auto max-w-3xl animate-[softRise_0.65s_ease-out]">
          <AnimatedChat />
        </div>
      </div>
    </section>
  )
}

// ── Trust bar ─────────────────────────────────────────────────────────────────

function TrustBar() {
  const integrations = ['Discord', 'Slack', 'Telegram', 'Email', 'GitHub', 'Website Widget']
  return (
    <section className="border-b border-border bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-ink-400 mb-6">Works with your existing tools</p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {integrations.map((name) => (
            <span key={name} className="text-sm font-semibold text-ink-400 hover:text-brand-700 transition-colors">{name}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function Stats() {
  const items = [
    { stat: '2-pass review', label: 'a second model grades every answer before it posts' },
    { stat: '5 providers', label: 'plus any OpenAI-compatible endpoint — bring your own key' },
    { stat: '6 channels', label: 'Discord, Slack, GitHub, Telegram, Email, and your website' },
    { stat: '14 days', label: 'try any hosted plan free before your card is charged' },
  ]
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-2 sm:grid-cols-4 gap-8">
        {items.map((item) => (
          <div key={item.stat} className="text-center">
            <div className="text-3xl font-bold text-brand-600">{item.stat}</div>
            <div className="mt-2 text-sm text-gray-500 leading-snug">{item.label}</div>
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
      n: '01',
      title: 'Connect your community',
      body: 'Paste your Discord bot token or Slack credentials. AnswerLoops starts ingesting questions immediately — no code required.',
      detail: 'Supports Discord servers, Slack workspaces, and embeddable web widget. All three can run simultaneously.',
    },
    {
      n: '02',
      title: 'AI reads and understands',
      body: 'Every question is classified, embedded, and matched against prior resolved answers and your uploaded docs.',
      detail: 'Works with your existing knowledge: paste docs, upload PDFs, or ingest URLs. Grounded answers only — no hallucinations.',
    },
    {
      n: '03',
      title: 'High-confidence replies post automatically',
      body: 'A reviewer model grades each answer. High-confidence, fully-answered replies post automatically.',
      detail: 'Low-confidence questions queue for a human with a ready-to-edit draft. The AI knows what it does not know.',
    },
    {
      n: '04',
      title: 'Gets smarter every week',
      body: 'Community 👍/👎 feedback prunes bad answers. Resolved tickets promote into the knowledge base.',
      detail: 'No retraining step — the next matching question just has a better answer to pull from.',
    },
  ]
  return (
    <section id="how-it-works" className="bg-gray-50 border-y border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-ink-900">From setup to self-improving in minutes</h2>
          <p className="mt-3 text-ink-500 max-w-xl mx-auto">Connect a channel and the AI pipeline is already running — classification, retrieval, and confidence grading ship together, not as separate add-ons.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-surface p-8 shadow-sm shadow-ink-900/[0.03] hover:shadow-md hover:border-brand-200 transition-all">
              <div className="text-xs font-bold text-brand-500 tracking-widest mb-3">{s.n}</div>
              <h3 className="text-lg font-semibold text-ink-900 mb-2">{s.title}</h3>
              <p className="text-sm text-ink-600 leading-relaxed mb-3">{s.body}</p>
              <p className="text-xs text-ink-400 leading-relaxed border-t border-border pt-3">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      ),
      title: 'Instant deflection',
      body: 'High-confidence answers post automatically in seconds. No human in the loop for questions the AI is sure about.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      ),
      title: 'Confidence gate',
      body: 'A separate reviewer model grades every answer. Only fully-answered, high-confidence replies go live. The AI knows when to escalate.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      ),
      title: 'Bring your own LLM',
      body: 'OpenAI, Anthropic, Google, Groq, Mistral, or any OpenAI-compatible endpoint. No platform AI bill — your key, your cost.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
        </svg>
      ),
      title: 'Smart escalation',
      body: 'Questions below the confidence threshold route to your team with a ready-to-edit AI draft. Humans only touch the hard ones.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      ),
      title: 'Analytics & ROI',
      body: 'Deflection rate, hours saved, per-category accuracy — all live. Turns ticket data into a number a budget owner can sign off on.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/>
        </svg>
      ),
      title: 'Embeddable widget',
      body: 'The same self-improving KB available on any website via a script tag. One platform, every channel.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      ),
      title: 'Self-improving KB',
      body: 'Resolved tickets auto-promote into the knowledge base. Community feedback prunes bad answers. Deflection rate climbs passively.',
    },
    {
      icon: (
        <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      ),
      title: 'Self-host on your infra',
      body: 'Open source. Clone and run docker compose up. Your data never leaves your servers. Privacy-first, fintech-ready.',
    },
  ]
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900">Everything your support team needs</h2>
          <p className="mt-3 text-gray-500">One pipeline, not a stack of tools you have to wire together yourself.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-6 hover:border-brand-100 hover:bg-brand-50/20 transition-colors">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-white shadow-sm">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Enterprise ────────────────────────────────────────────────────────────────

function Enterprise() {
  const perks = [
    'SSO / SAML (Google, Okta, Azure AD)',
    'Audit logs & compliance exports',
    'Custom data retention policies',
    'Dedicated Slack support channel',
    'SLA-backed uptime guarantee',
    'White-label widget (remove branding)',
    'Custom AI model endpoints',
    'DPA / BAA available on request',
  ]
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-brand-950 p-10 md:p-14 flex flex-col md:flex-row gap-12">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 mb-6">Enterprise</div>
            <h2 className="text-3xl font-bold text-white mb-4">Built for regulated industries</h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Fintech, healthcare, and enterprise teams need data isolation, audit trails, and legal agreements. AnswerLoops ships all of it — or you self-host and own everything.
            </p>
            <div className="flex flex-col gap-3">
              <WaitlistForm dark />
              <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                <GithubIcon />
                View source on GitHub
              </Link>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
            {perks.map((p) => (
              <div key={p} className="flex items-start gap-2.5">
                <svg className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
                <span className="text-sm text-slate-300">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Self-host callout ─────────────────────────────────────────────────────────

function SelfHostCallout() {
  return (
    <section className="bg-gray-50 border-y border-gray-100 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 mb-4">
              <GithubIcon className="h-3 w-3" />
              Open source
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Self-host in three steps</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4 max-w-lg">
              Clone the repo, add your env vars, run one command. Your community data stays on your servers — not ours. Privacy-first teams, fintech, and regulated industries choose this path.
            </p>
            <div className="bg-gray-950 rounded-xl px-5 py-4 font-mono text-sm text-green-400 max-w-lg">
              docker compose -f docker-compose.prod.yml up --build -d
            </div>
          </div>
          <div className="flex flex-col gap-3 md:min-w-[200px]">
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              <GithubIcon />
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
// Copy phrased the way people actually ask an AI assistant ("what is X",
// "how does X do Y"), not how a marketing team titles a section — this is
// the GEO content Perplexity/ChatGPT-with-search retrieve and cite directly.
// FAQ_ITEMS also feeds the FAQPage JSON-LD in StructuredData below, so the
// structured data always mirrors what's actually visible on the page.

const FAQ_ITEMS = [
  {
    q: 'What is AnswerLoops?',
    a: 'AnswerLoops is an AI support platform for developer communities. It watches Discord, Slack, GitHub Issues/Discussions, Telegram, email, and your website chat widget, answers repeat questions automatically from your knowledge base, and routes anything it isn\'t confident about to a human with an AI-drafted reply ready to edit.',
  },
  {
    q: 'How does AnswerLoops decide when to auto-answer vs. escalate to a human?',
    a: 'Every drafted answer goes through a second AI pass that grades its own confidence. Only answers that clear a configurable threshold post automatically — everything else queues for a human, with the AI\'s draft attached so staff aren\'t starting from scratch.',
  },
  {
    q: 'Can I use my own AI provider with AnswerLoops?',
    a: 'Yes. Each organization configures its own key for OpenAI, Anthropic, Google Gemini, Groq, Mistral, or any OpenAI-compatible endpoint (including local models via Ollama). There\'s no platform AI markup — you pay your provider directly.',
  },
  {
    q: 'Is AnswerLoops open source?',
    a: 'Yes, the core platform is open source. Clone the repo and run docker compose up to self-host on your own infrastructure with your data never leaving your servers. A hosted version with tiered plans is also available if you\'d rather not run it yourself. License details are on GitHub.',
  },
  {
    q: 'Does AnswerLoops work with AI coding agents like Claude Code or Cursor?',
    a: 'Yes — AnswerLoops ships an MCP (Model Context Protocol) server, so any MCP-compatible agent can search your knowledge base, read tickets, open new ones, and generate grounded answers directly, using the same pipeline as every other support channel.',
  },
  {
    q: 'How is AnswerLoops different from Intercom or Chatbase?',
    a: 'Intercom and Chatbase are built support/chatbot tools with AI added on top. AnswerLoops is AI-first: the confidence-gated auto-answer pipeline is the product, not a feature bolted onto a human-first inbox. It\'s also the only one of the three that\'s fully open source and self-hostable. See the comparison pages linked in the footer for a feature-by-feature breakdown.',
  },
] as const

function FAQ() {
  return (
    <section id="faq" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Frequently asked questions</h2>
        </div>
        <div className="flex flex-col gap-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="rounded-2xl border border-gray-100 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{item.q}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="bg-black">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white">Stop answering the same question by hand.</h2>
        <p className="mt-4 text-gray-400 text-lg max-w-xl mx-auto">Be first in line when we open the doors.</p>
        <div className="mt-10 mx-auto max-w-lg">
          <WaitlistForm dark />
          <p className="mt-3 text-xs text-slate-500">No spam. Unsubscribe any time.</p>
        </div>
      </div>
    </section>
  )
}

// ── Structured data ─────────────────────────────────────────────────────────
// Product + Offer JSON-LD so AI search engines (Perplexity, Bing Copilot,
// Gemini) can extract pricing and feature info accurately instead of
// guessing from prose. Mirrors ORDERED_PLANS — kept in sync manually since
// this is server-rendered from the same source of truth, not duplicated data.

function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AnswerLoops',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'AI community support platform that auto-answers repeat Discord, Slack, GitHub, Telegram, and email questions from your knowledge base, escalating only the hard ones to a human.',
    url: 'https://answerloops.com',
    offers: [
      {
        '@type': 'Offer',
        name: 'Self-hosted',
        price: '0',
        priceCurrency: 'USD',
        description: 'Open source. Full source code, runs on your own infrastructure.',
      },
      ...ORDERED_PLANS.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        price: (plan.priceMonthly / 100).toString(),
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: (plan.priceMonthly / 100).toString(),
          priceCurrency: 'USD',
          billingDuration: 'P1M',
        },
        description: plan.deflectionsPerMonth === null
          ? 'Unlimited deflections/mo, 14-day free trial'
          : `${plan.deflectionsPerMonth.toLocaleString()} deflections/mo, 14-day free trial`,
      })),
    ],
  }

  // FAQPage schema mirrors the visible FAQ section below (FAQ_ITEMS) —
  // required to keep the markup honest per Google's structured-data
  // guidance, which is why this was deferred in the first GEO pass until
  // an actual FAQ section existed on the page.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const session = await auth()

  return (
    <div className="min-h-screen bg-white">
      <StructuredData />
      <Nav loggedIn={!!session?.user} />
      <Hero />
      <TrustBar />
      <Stats />
      <HowItWorks />
      <Features />
      <Enterprise />
      <SelfHostCallout />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  )
}
