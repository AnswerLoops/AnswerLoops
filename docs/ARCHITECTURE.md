# Community Support Platform — Architecture

> How every piece connects: from a Discord message to a deflected answer and a self-improving knowledge base.

---

## 1. One-paragraph thesis

A community member asks a question in Discord. The platform ingests it, triages it with AI, embeds it to find prior similar questions, drafts an answer grounded in the team's past answers and the project's source code, grades that answer's confidence, and either **auto-answers** the community (high confidence) or **routes it to a human** (low confidence). Resolved answers feed back into the knowledge base so repeat questions get cheaper and faster over time. Staff manage everything from a gated web dashboard.

---

## 2. System map

```
                         ┌──────────────────────────────┐
                         │          Discord              │
                         │  (community asks questions)   │
                         └───────────────┬──────────────┘
                                         │  new message
                                         ▼
                         ┌──────────────────────────────┐
                         │   Bot service (bot/index.ts)  │
                         │   discord.js, long-running    │
                         └───────────────┬──────────────┘
                                         │ POST /api/ingest  (Bearer BOT_SECRET)
                                         ▼
        ┌────────────────────────────────────────────────────────────────┐
        │                  Next.js app (App Router, Next 16)              │
        │                                                                │
        │  /api/ingest ──► triage ──► embed ──► find related ──► agent   │
        │                                                  │             │
        │                                                  ▼             │
        │                                            assess answer       │
        │                                          (auto vs human)       │
        │                                                                │
        │  proxy.ts gates all dashboard + API routes (staff session)     │
        │                                                                │
        │  Dashboard pages: /dashboard /tickets /faq /settings /login    │
        └───────────────────────────────┬────────────────────────────────┘
                                         │ better-sqlite3 (WAL)
                                         ▼
                         ┌──────────────────────────────┐
                         │   SQLite  (data/community.db) │
                         │   tickets, embeddings, links, │
                         │   assessments, faq, events…   │
                         └──────────────────────────────┘

   External services: OpenAI (triage / embeddings / agent / reviewer),
   GitHub App (source-code search for the agent), Web Push (staff alerts).
```

---

## 3. The ingest pipeline (the core flow)

File: `app/api/ingest/route.ts`. Triggered by the bot. Auth: `Authorization: Bearer ${BOT_SECRET}`.

| # | Step | Code | Model | Output |
|---|------|------|-------|--------|
| 1 | **Validate + dedup** | Zod schema, `getTicketByDiscordMessageId` | — | reject dup Discord messages |
| 2 | **Triage** | `lib/ai/triage.ts` | gpt-4o-mini (structured) | category, severity 0–1, summary, suggested priority |
| 3 | **SLA deadlines** | `lib/sla/engine.ts` | — | response + resolve deadlines by priority |
| 4 | **Create ticket** | `lib/db/queries/tickets.ts` | — | row in `tickets`, `created` event |
| 5 | **In-app + push notify** | notifications + `lib/push/notify.ts` | — | staff alerted |
| 6 | **Embed** | `lib/ai/embed.ts` | text-embedding-3-small | vector → `ticket_embeddings` |
| 7 | **Find related** | `lib/ai/related.ts` (cosine) | — | top-K neighbours → `ticket_links`; flag duplicates |
| 8 | **Agent answer** | `lib/ai/agent.ts` | gpt-4o + tools | draft grounded in prior answers, then GitHub source |
| 9 | **Assess** | `lib/ai/assess.ts` | gpt-4o-mini (structured) | confidence + answered_fully → `ai_assessments` |
| 10 | **Deflect or route** | agent | — | auto-answer Discord **or** post draft for human review |

Steps 5–10 run in Next's `after()` (post-response background work) so the bot's POST returns fast. Each AI block is wrapped in try/catch — a failure never blocks ticket creation, and an assessment failure defaults to **human review** (never auto-deflects on error).

---

## 4. The two AI agents (and the reviewer)

1. **Triage** (`lib/ai/triage.ts`) — `generateObject`, gpt-4o-mini. Classifies type + urgency. Cheap, runs on every message.
2. **Answer agent** (`lib/ai/agent.ts`) — `generateText` with tools, gpt-4o, max 5 steps. Tools hit the GitHub App: `searchCode`, `readFile`, `listFiles` (`lib/github/tools.ts`). **Prefers reusing prior resolved answers** (injected into the system prompt) before crawling source — cheaper, faster, consistent.
3. **Reviewer** (`lib/ai/assess.ts`) — `generateObject`, gpt-4o-mini. A *separate* pass grading the agent's answer for confidence + completeness. Conservative by prompt. Drives the auto-deflect decision (`shouldAutoDeflect`, threshold `0.8`).

---

## 5. Data model (SQLite)

Schema: `lib/db/schema.sql`. Connection: `lib/db/index.ts` (WAL, foreign keys, schema applied idempotently on boot).

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `tickets` | one row per community question | category, severity_score, ai_summary, ai_draft, ai_draft_status, priority, status, sla_* , resolution_notes |
| `ticket_replies` | staff replies | ticket_id, staff_name, content |
| `ticket_events` | audit log | event_type, old/new value, actor |
| `ticket_embeddings` | semantic vector per ticket | vector (JSON), model |
| `ticket_links` | nearest-neighbour graph | ticket_id, related_id, score |
| `ai_assessments` | confidence grade per answer | confidence, answered_fully, auto_deflected, reasoning |
| `sla_configs` | response/resolve hours by priority | seeded: critical→low |
| `faq_snapshots` | weekly generated FAQ | week range, content, ticket_count |
| `notifications` | in-app staff alerts | type, message, read |
| `push_subscriptions` | web-push endpoints | endpoint, p256dh, auth |
| `github_repos` | repos the agent can search | installation_id, owner, repo |

**Design note:** enrichment tables (`ticket_embeddings`, `ticket_links`, `ai_assessments`) are **side tables** keyed by `ticket_id` — added with `CREATE TABLE IF NOT EXISTS`, never `ALTER`, so they apply cleanly to an existing database.

---

## 6. Web app surface

- **Auth** — `proxy.ts` (Next 16 renamed `middleware`→`proxy`) gates every route except `/login` and `/api/ingest`. Shared-password staff login; signed httpOnly cookie (`lib/auth/`). Unauthenticated pages redirect to `/login`; APIs return 401.
- **Dashboard** (`app/(dashboard)/`) — stats cards (open, SLA breaches, **Needs Review**, **Auto-Answered**), SLA list, recent tickets. Live-refreshes every 5s.
- **Tickets** — list + detail. Detail shows original message, AI draft (approve/edit/dismiss), **confidence badge + reasoning**, **related questions** + "Asked N×", SLA, replies, activity log.
- **FAQ** — weekly snapshot generation from resolved tickets (`lib/ai/faq-generator.ts`).
- **Settings** — connect GitHub repos for the agent to search.

---

## 7. External dependencies

| Service | Used for | Config |
|---------|----------|--------|
| OpenAI | triage, embeddings, answer agent, reviewer | `OPENAI_API_KEY` |
| GitHub App | source-code search tools | `lib/github/app.ts`, installed repos |
| Discord | ingest source + answer delivery | bot token, `BOT_SECRET` |
| Web Push | staff notifications | VAPID keys |

**Required env:** `OPENAI_API_KEY`, `BOT_SECRET`, `SESSION_SECRET`, `STAFF_PASSWORD`, Discord + GitHub + VAPID credentials. (See `.env.local.example`.)

---

## 8. Deployment

- `Dockerfile` (Node 20 Alpine, builds better-sqlite3 natively) + `docker-compose.yml` (app + bot services).
- **Known gap:** compose currently runs `pnpm dev` with a source bind-mount — dev mode, not a built image. SQLite is a single file (`data/`), so it must be a persistent volume. See the build plan, Hardening track.

---

## 9. Current state (June 2026)

**Shipped this cycle (open PRs):**
- `#5` Shared-password staff auth (proxy gate, session cookie).
- `#6` Semantic enrichment (embeddings, dedup, prior-answer reuse).
- `#7` Confidence scoring + auto-deflection (reviewer pass, auto vs human).

**Pipeline live end-to-end:** Discord → triage → embed → related → agent → assess → deflect/route → dashboard.

Next steps and dependencies: see `docs/BUILD-PLAN.md`.
