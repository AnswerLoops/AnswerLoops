<div align="center">

<img src="./public/logo.png" alt="AnswerLoops" width="88" />

# AnswerLoops

**Your community keeps asking the same question. Stop answering it by hand.**

[Website](https://answerloops.com) · [Docs](https://answerloops.com/docs) · [Cloud](https://app.answerloops.com) · [Self-host](#self-host-in-5-minutes)

![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![Postgres](https://img.shields.io/badge/Postgres-Drizzle-336791) ![BYO LLM](https://img.shields.io/badge/LLM-bring%20your%20own-8A2BE2)

<img src="./.github/readme/dashboard.png" alt="AnswerLoops dashboard — deflection rate, auto-answered tickets, and open questions across Discord, Slack, GitHub, and email" width="100%" />

</div>

---

It's 11pm. Someone drops into your Discord: *"how do I reset my API key?"* You've answered this exact question 200 times. You paste the same three sentences you always do, link the docs, move on. Tomorrow someone else asks it in Slack. Next week, in a GitHub issue.

The obvious fix — bolt on a chatbot — makes it worse. A bare LLM doesn't know your product, so it confidently invents an API that doesn't exist and your users trust it because it *sounds* right. The other obvious fix — hire more support — doesn't scale with an open-source project's budget or a startup's headcount.

AnswerLoops is the thing in between. It reads the question, searches *your* actual docs and past resolved tickets for a real answer, and has a second AI pass grade its own confidence before it's allowed to post anything. High confidence → it replies in-thread, in Discord, Slack, GitHub, wherever the question came from. Every resolved ticket feeds back into the knowledge base, so the 201st time someone asks, the answer's already better — and a knowledge-gaps view tells you exactly which doc is still missing.

It's open source, self-hostable, and yours to run with your own AI provider key — no platform markup, no lock-in, a local model via Ollama if you'd rather not send data anywhere.

## When the AI isn't sure, it says nothing

This is the part that makes auto-answering safe to turn on. Every draft gets graded before it can post. A production outage at 34% confidence doesn't get a hallucinated guess — it gets silence and a ping to your support role, with the reasoning attached:

<div align="center">
<img src="./.github/readme/ticket-detail.png" alt="Ticket detail — the AI scored itself 34% confident, refused to answer, and escalated to a human with its reasoning" width="100%" />
</div>

You set the threshold. And before you go live at all, **simulation mode** dry-runs the AI against your past tickets — zero replies sent, zero writes — so you can see exactly what it *would have* said.

## One inbox, every channel

Questions arrive from Discord, Slack, GitHub Issues & Discussions, Telegram, email, and your website widget — and land in one queue with AI-written summaries, categories, and priorities already attached:

<div align="center">
<img src="./.github/readme/tickets.png" alt="Unified ticket inbox — source badges for Discord, Slack, GitHub, and email, with AI-assigned categories and priorities" width="100%" />
</div>

## The loop

```
   Question           Search              Gate                Act
  ┌────────┐      ┌──────────────┐   ┌────────────┐   ┌──────────────────┐
  │ Discord│      │  semantic    │   │ confidence │   │ ≥ threshold → post│
  │ Slack  │ ───► │  vector      ├─► │  score by  ├─► │ answer in thread  │
  │ GitHub │      │  search over │   │  reviewer  │   │                   │
  │ Email  │      │  your KB     │   │  AI        │   │ < threshold → ping│
  │ Widget │      └──────────────┘   └────────────┘   │ a human to handle │
  └────────┘                                          └──────────────────┘
                                                              │
                                              resolved ticket │ promoted
                                                     back into ▼ the KB (loop closes)
```

## Features

| | |
|---|---|
| **Multi-channel ingest** | Discord (text + forum), Slack, GitHub Issues & Discussions, Telegram, Email, embeddable website widget |
| **AI deflection** | Confidence-gated auto-answers with a configurable threshold — never posts when unsure |
| **Knowledge base** | URL crawl, file upload (PDF/DOCX/MD/TXT/CSV), GitHub repo sync, or promote resolved tickets |
| **Bring-your-own-LLM** | OpenAI, Anthropic, Google Gemini, Groq, Mistral, or local Ollama |
| **Agent-first API** | [MCP server](https://answerloops.com/docs/integrations/mcp) (JSON-RPC) **and** a [REST Agent API](https://answerloops.com/docs/integrations/agent-api) + OpenAPI spec — let AI agents search your KB, open tickets, and generate answers |
| **Simulation mode** | Dry-run the AI against your past tickets — zero replies sent, zero writes — before going live |
| **Knowledge gaps** | Surfaces unanswered questions so you know which docs to write |
| **Human escalation + CSAT** | Pings a support role on low confidence; sends satisfaction prompts back through the same channel |
| **Multi-tenant** | Org workspaces, OAuth login, per-org data isolation, team invites, usage-based billing |

## Self-host in 5 minutes

**Prerequisites:** Docker + Docker Compose, an AI provider key (OpenAI recommended), and at least one OAuth app (GitHub, Discord, or Google).

```bash
git clone https://github.com/AnswerLoops/AnswerLoops.git
cd AnswerLoops
cp .env.example .env.local   # fill in the values below
docker compose up --build
```

Minimum `.env.local`:

```env
# Core
DATABASE_URL=postgresql://community:community@postgres:5432/community
AUTH_URL=http://localhost:3000
AUTH_SECRET=<run: openssl rand -hex 32>
ENCRYPTION_KEY=<run: openssl rand -hex 32>

# At least one OAuth provider
AUTH_GITHUB_ID=<your-github-client-id>
AUTH_GITHUB_SECRET=<your-github-client-secret>

# AI (powers deflection + KB search)
OPENAI_API_KEY=<your-openai-api-key>
```

That's it — Compose brings up the **app** (`http://localhost:3000`), the **bot** listener, and **Postgres**. Drizzle migrations run automatically on first start. Open the app, sign in with OAuth, and the onboarding wizard walks you through connecting your first channel.

> [!WARNING]
> Use `docker compose down` to stop. **Never** `docker compose down -v` — the `-v` deletes the Postgres volume and all your data.

> [!NOTE]
> This project uses **Auth.js v5** — the env vars are `AUTH_URL` / `AUTH_SECRET`, not `NEXTAUTH_URL` / `NEXTAUTH_SECRET`. See the [full environment variable reference](https://answerloops.com/docs/reference/environment-variables) for every option.

Prefer not to run infrastructure? [**Cloud**](https://app.answerloops.com) gives you the same product with 1-click Discord OAuth and no setup.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev:all          # runs the Next.js app + the bot listener together
```

App at `http://localhost:3000`. Run the pieces separately with `pnpm dev` and `pnpm bot` if you prefer.

```bash
pnpm test             # vitest unit/integration suite
pnpm test:e2e         # Playwright end-to-end
pnpm build            # production build + typecheck
```

## Tech stack

- **Next.js 16** (App Router) — dashboard + API routes
- **Postgres + Drizzle ORM** — typed schema, auto-run migrations
- **Auth.js v5** — GitHub / Discord / Google OAuth, multi-tenant sessions
- **Vercel AI SDK** — one interface over OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama
- **Bot service** — Discord gateway + Slack listener, per-org credentials from the DB
- **Docker Compose** — app, bot, and Postgres as separate services

## Documentation

Full docs live at **[answerloops.com/docs](https://answerloops.com/docs)** — self-hosting guides, per-channel integration setup, the product guide, and the API reference (MCP + REST).

## License

[AGPL-3.0](./LICENSE). Free to self-host, modify, and run. If you offer AnswerLoops as a network service, the AGPL requires you to share your modifications.
