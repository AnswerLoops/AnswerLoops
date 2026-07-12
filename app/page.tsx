import Link from 'next/link'
import { auth } from '@/auth'
import { ORDERED_PLANS } from '@/lib/billing/plans'
import { LogoMark, Logo } from '@/components/logo'
import { AnimatedChat } from '@/components/animated-chat'
import { WaitlistForm } from '@/components/waitlist-form'
import { MobileDrawer } from '@/components/ui/mobile-drawer'

export const dynamic = 'force-dynamic'

const GITHUB_URL = 'https://github.com/NathanTarbert/community-platform'

const GithubIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
)

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/"><Logo width={110} /></Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">How it works</Link>
            <Link href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Pricing</Link>
            <a href="https://docs.answerloops.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Docs</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <GithubIcon />
            GitHub
          </Link>
          {loggedIn ? (
            <Link href="/dashboard" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
              Go to dashboard →
            </Link>
          ) : (
            <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
              Coming soon
            </span>
          )}
          <MobileDrawer triggerLabel="Open navigation" triggerClassName="md:hidden">
            <nav className="flex flex-col p-4 gap-1">
              <Link href="#features" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Features</Link>
              <Link href="#how-it-works" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">How it works</Link>
              <Link href="#pricing" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Pricing</Link>
              <a href="https://docs.answerloops.com" target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Docs</a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <GithubIcon />
                GitHub
              </a>
            </nav>
          </MobileDrawer>
        </div>
      </div>
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function ChatMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex items-center gap-1.5 mx-auto">
          <LogoMark size={16} className="text-brand-600" />
          <span className="text-xs font-medium text-gray-500">AnswerLoops — #support</span>
        </div>
      </div>
      <div className="p-4 space-y-4 min-h-[280px] bg-white">
        <div className="flex gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">A</div>
          <div className="flex-1">
            <div className="text-[11px] text-gray-400 mb-1">alex <span className="text-gray-300">today at 2:14 PM</span></div>
            <div className="rounded-xl rounded-tl-none bg-gray-100 px-3 py-2 text-xs text-gray-700 max-w-xs">
              How do I reset my API key? I can&apos;t find the settings page
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-full bg-brand-600 flex items-center justify-center">
            <LogoMark size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-gray-400 mb-1">AnswerLoops <span className="rounded bg-brand-100 px-1 py-0.5 text-brand-600 text-[9px] font-bold">AI</span> <span className="text-gray-300">today at 2:14 PM</span></div>
            <div className="rounded-xl rounded-tl-none bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-gray-700 max-w-sm leading-relaxed">
              To reset your API key, go to <span className="font-medium text-brand-700">Settings → API Keys</span> and click &quot;Regenerate&quot;. Your old key will be invalidated immediately. You can find your settings by clicking your avatar in the top-right corner.
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                Auto-posted · 98% confidence
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px] font-bold">M</div>
          <div className="flex-1">
            <div className="text-[11px] text-gray-400 mb-1">maria <span className="text-gray-300">today at 2:19 PM</span></div>
            <div className="rounded-xl rounded-tl-none bg-gray-100 px-3 py-2 text-xs text-gray-700 max-w-xs">
              Do you support SSO with Google Workspace?
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="h-7 w-7 shrink-0 rounded-full bg-brand-600 flex items-center justify-center">
            <LogoMark size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-gray-400 mb-1">AnswerLoops <span className="rounded bg-brand-100 px-1 py-0.5 text-brand-600 text-[9px] font-bold">AI</span> <span className="text-gray-300">today at 2:19 PM</span></div>
            <div className="rounded-xl rounded-tl-none bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-gray-700 max-w-sm leading-relaxed">
              Yes! Google Workspace SSO is available on the Enterprise plan. You can configure it under <span className="font-medium text-brand-700">Settings → Authentication → SAML/SSO</span>.
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                Auto-posted · 96% confidence
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-brand-900/50 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-brand-950/60 via-transparent to-transparent" />
      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 mb-8">
            <GithubIcon className="h-3 w-3" />
            Open source · AGPL-3.0 · Self-host free
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
            AI agents for your
            <br />
            <span className="text-brand-400">developer community</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed">
            Connect Discord or Slack. AnswerLoops triages every question with AI, answers from your own docs and resolved tickets, and auto-posts replies — so your team handles only the hard 10%.
          </p>
          <div className="mt-10 mx-auto max-w-lg">
            <WaitlistForm dark />
            <p className="mt-3 text-xs text-slate-500 text-center">Be first to know when we launch. No spam.</p>
          </div>
        </div>
        <div className="mt-16 mx-auto max-w-2xl">
          <AnimatedChat />
        </div>
      </div>
    </section>
  )
}

// ── Trust bar ─────────────────────────────────────────────────────────────────

function TrustBar() {
  const integrations = ['Discord', 'Slack', 'Telegram', 'Email', 'GitHub', 'Webhooks']
  return (
    <section className="border-b border-gray-100 bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-gray-400 mb-6">Works with your existing tools</p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {integrations.map((name) => (
            <span key={name} className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">{name}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function Stats() {
  const items = [
    { stat: '80%+', label: 'questions auto-answered after 30 days' },
    { stat: '< 5 min', label: 'to first AI reply after setup' },
    { stat: '6 LLMs', label: 'supported — bring your own key' },
    { stat: '1 command', label: 'to self-host on your own infra' },
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
      detail: 'The deflection rate climbs without anyone retraining anything. Value compounds over time.',
    },
  ]
  return (
    <section id="how-it-works" className="bg-gray-50 border-y border-gray-100 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900">From setup to self-improving in minutes</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">The whole pipeline ships on day one — nothing to assemble, no ML team required.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-bold text-brand-500 tracking-widest mb-3">{s.n}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">{s.body}</p>
              <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-3">{s.detail}</p>
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
      body: 'AGPL-3.0 licensed. Clone and run docker compose up. Your data never leaves your servers. Privacy-first, fintech-ready.',
    },
  ]
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900">Everything your support team needs</h2>
          <p className="mt-3 text-gray-500">No stitching tools together. No prompt engineering. Ship in an afternoon.</p>
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

// ── Testimonials ──────────────────────────────────────────────────────────────

function Testimonials() {
  const quotes = [
    {
      quote: "We went from spending 4 hours a day on repeat Discord questions to under 30 minutes. The AI just handles it.",
      name: 'Jordan K.',
      role: 'Developer Relations, open-source OSS project',
      avatar: 'J',
      color: 'bg-violet-500',
    },
    {
      quote: "Self-hosting was a one-liner. Our legal team was thrilled — user data never leaves our VPC.",
      name: 'Priya M.',
      role: 'CTO, B2B SaaS startup',
      avatar: 'P',
      color: 'bg-emerald-500',
    },
    {
      quote: "Deflection rate hit 74% in the first month without us doing anything. It just gets better on its own.",
      name: 'Sam R.',
      role: 'Community Lead, developer platform',
      avatar: 'S',
      color: 'bg-blue-500',
    },
  ]
  return (
    <section className="bg-warm-100 border-y border-warm-200 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Loved by developer communities</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <div key={q.name} className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm flex flex-col">
              <svg className="h-6 w-6 text-brand-200 mb-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
              </svg>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">{q.quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full ${q.color} flex items-center justify-center text-white text-sm font-bold`}>{q.avatar}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{q.name}</div>
                  <div className="text-xs text-gray-400">{q.role}</div>
                </div>
              </div>
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
                Self-host (AGPL-3.0)
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
              Open source · AGPL-3.0
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">One command to self-host</h2>
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

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Hosted plans — or self-host free</h2>
          <p className="mt-3 text-gray-500">All hosted plans start with a 14-day free trial. Prefer full control? Self-host is always free.</p>
        </div>

        {/* Self-host row */}
        <div className="mb-4 rounded-2xl border-2 border-gray-200 bg-gray-50 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">Self-hosted</span>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">AGPL-3.0</span>
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
            className="shrink-0 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <GithubIcon />
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
                className={`rounded-2xl border-2 p-7 flex flex-col ${isHighlight ? 'border-brand-500 bg-brand-50/40 shadow-lg' : 'border-gray-200 bg-white'}`}
              >
                {isHighlight && (
                  <div className="mb-3">
                    <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Most popular</span>
                  </div>
                )}
                <div className="text-base font-semibold text-gray-900">{plan.name}</div>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold text-gray-900">${plan.priceMonthly / 100}</span>
                  <span className="text-sm text-gray-500 mb-1.5">/mo</span>
                </div>
                <div className="mt-1 text-xs text-brand-600 font-medium">14-day free trial</div>
                <div className="mt-3 text-sm text-gray-500">
                  {plan.deflectionsPerMonth === null
                    ? 'Unlimited deflections'
                    : `${plan.deflectionsPerMonth.toLocaleString()} deflections/mo`}
                </div>
                <div className="flex-1" />
                <div className={`mt-8 w-full rounded-xl py-2.5 text-center text-xs font-semibold ${
                    isHighlight
                      ? 'bg-brand-100 text-brand-600'
                      : 'border-2 border-gray-200 text-gray-400'
                  }`}>
                  Available at launch
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-8 text-center text-sm text-gray-400">
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
    <section className="bg-black">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white">Your community deserves better than copy-paste answers.</h2>
        <p className="mt-4 text-gray-400 text-lg max-w-xl mx-auto">Be first in line when we open the doors.</p>
        <div className="mt-10 mx-auto max-w-lg">
          <WaitlistForm dark />
          <p className="mt-3 text-xs text-slate-500">No spam. Unsubscribe any time.</p>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <div className="mb-3">
              <Logo width={90} />
            </div>
            <p className="text-xs text-gray-400 max-w-xs">AI-powered support automation for developer communities. Open source, self-hostable.</p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
              <GithubIcon className="h-3 w-3" />
              <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">AGPL-3.0 — view source</Link>
            </div>
          </div>
          <div className="flex gap-12">
            <div>
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Product</div>
              <div className="flex flex-col gap-2">
                <Link href="#features" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Features</Link>
                <Link href="#how-it-works" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">How it works</Link>
                <Link href="#pricing" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Pricing</Link>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Open source</div>
              <div className="flex flex-col gap-2">
                <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">GitHub</Link>
                <Link href={`${GITHUB_URL}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Docs</Link>
                <Link href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Issues</Link>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Product</div>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-400">Coming soon</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">© 2026 AnswerLoops. AGPL-3.0 licensed.</p>
          <p className="text-xs text-gray-400">Built in public · No VC money · Self-hostable</p>
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
      <TrustBar />
      <Stats />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Enterprise />
      <SelfHostCallout />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
