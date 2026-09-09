import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer, Nav } from '@/components/marketing/chrome'
import { PageSchema } from '@/components/marketing/page-schema'
import { MARKETED_CHANNEL_NAMES } from '@/lib/marketing/channels'

export const metadata: Metadata = {
  title: 'What Is an Agentic Support Platform? — AnswerLoops',
  description:
    'AnswerLoops is an agentic support platform for teams whose users ask for help in a community. One agent drafts an answer from your docs and resolved tickets; a second checks it against those sources before it posts in the thread — Discord, Slack, Discourse, Circle, GitHub, Telegram, email, and a website widget. Open source and self-hostable.',
  alternates: { canonical: '/agentic-support' },
  openGraph: {
    title: 'What Is an Agentic Support Platform? — AnswerLoops',
    description:
      'A drafting agent and a checking agent answer repeat questions in the channel they were asked, cited to your docs — and hand a teammate the finished draft when the check comes back short. Open source, self-hostable.',
    url: '/agentic-support',
  },
  twitter: {
    title: 'Agentic Support for Your Community — AnswerLoops',
    description:
      'One agent drafts, a second checks it against your docs, and the answer posts in the Discord, Slack, forum, or GitHub thread it was asked in. Open source, self-hostable.',
  },
}

// Canonical marketed list — see lib/marketing/channels.ts.
const CHANNELS = MARKETED_CHANNEL_NAMES

const CAPABILITIES = [
  {
    title: 'Every answer cites its source',
    body: 'The drafting agent searches your docs, knowledge base, and resolved tickets first. If it can’t find support for a claim, that claim doesn’t make the draft.',
  },
  {
    title: 'A second agent has to sign off',
    body: 'Before anything posts, a reviewer agent checks the draft against the sources it cited and scores its confidence. Below the bar, it goes to a teammate with the draft attached — not a blank ticket.',
  },
  {
    title: 'One knowledge base, every channel',
    body: 'Discord, Slack, Discourse, Circle, GitHub, Telegram, email, and the website widget all read the same knowledge and run the same review. No per-channel bot to train.',
  },
  {
    title: 'Your agents call it too',
    body: 'AnswerLoops is an MCP server and a REST API. Claude Code, Cursor, or your own agent can search the knowledge base, read FAQs, open tickets, and get a grounded answer — through the same pipeline, with scoped permissions.',
  },
  {
    title: 'Open source, self-hostable',
    body: 'Run it on your own infrastructure with the source open to inspection, or use the managed service. Bring your own model provider either way.',
  },
]

export default function AgenticSupportPage() {
  return (
    <div className="min-h-screen bg-[#f5f8fd]">
      <PageSchema name="What is an agentic support platform?" description="Agentic support that lives in your community, across every community channel." path="/agentic-support" breadcrumbs={[{ name: 'Product', path: '/' }]} />
      <Nav />

      <main>
        <section className="relative isolate overflow-hidden bg-[#030611] py-24 sm:py-32">
          <div className="landing-grid pointer-events-none absolute inset-0 opacity-55" />
          <div className="pointer-events-none absolute left-1/2 top-[-20rem] h-[44rem] w-[72rem] -translate-x-1/2 rounded-[50%] bg-blue-600/25 blur-[140px]" />
          <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-blue-300">Agentic support infrastructure</p>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl">
              What is an agentic support platform?
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-pretty text-base leading-relaxed text-slate-200/75 sm:text-xl">
              It&apos;s support run by agents instead of a rules engine. When someone re-asks a question your community already answered, AnswerLoops&apos; drafting agent pulls the answer from your docs and resolved tickets, a reviewer agent checks it against those sources, and it posts in the thread where the question started — Discord, Slack, your forum, GitHub. If the reviewer isn&apos;t satisfied, a teammate gets the draft to finish.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login" className="w-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 sm:w-auto">
                Start your 14-day trial
              </Link>
              <Link href="/pricing" className="w-full rounded-full border border-white/20 px-6 py-3 text-center text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white sm:w-auto">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200/80 bg-white py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-5 sm:px-8">
            <span className="mr-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-slate-500">One agent across</span>
            {CHANNELS.map((channel) => (
              <span key={channel} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{channel}</span>
            ))}
          </div>
        </section>

        <section className="bg-white py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-blue-600">How it works</p>
              <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">Draft, check, post — or hand it to a person.</h2>
              <p className="mt-5 text-base leading-relaxed text-slate-600">A question becomes a ticket. The drafting agent answers it from your sources. The reviewer agent checks that answer and decides: post it in the thread, or route it to a teammate with the draft ready. Answers your team keeps become knowledge the next draft can cite.</p>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((capability) => (
                <article key={capability.title} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6">
                  <h3 className="text-lg font-semibold tracking-[-0.025em] text-slate-950">{capability.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{capability.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eef4fb] py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-blue-600">Open by design</p>
              <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">Use the hosted service or run it yourself.</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">AnswerLoops runs as a managed cloud service or as an open-source deployment on your own infrastructure. Either way you pick the model provider, and your own agents reach it over MCP or the REST API.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pricing" className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">Compare plans</Link>
                <Link href="/docs/quickstart-self-host" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400">Read the self-hosting guide</Link>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_70px_rgba(30,64,175,0.08)]">
              <p className="text-sm font-semibold text-slate-950">The short version</p>
              <ul className="mt-5 space-y-4 text-sm leading-relaxed text-slate-600">
                <li>✓ Repeat questions get a cited answer in the thread</li>
                <li>✓ A reviewer agent checks every draft before it posts</li>
                <li>✓ Below the confidence bar, a teammate gets the draft</li>
                <li>✓ Your own agents call the same pipeline over MCP</li>
                <li>✓ Open source and self-hostable</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-[#030611] py-24 text-center sm:py-32">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">Stop retyping last month&apos;s answer.</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300/70">Connect the channels your community already uses. AnswerLoops answers from the docs and tickets you already have.</p>
            <Link href="/login" className="mt-9 inline-flex rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110">Start your 14-day trial</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
