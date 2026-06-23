# Community Support Platform — Build Plan

> The roadmap, mapped: what's done, what's next, and how each phase depends on the others. Pairs with `docs/ARCHITECTURE.md`.

---

## Product arc

> Turn a stream of community questions into a **self-improving knowledge base that deflects repeat questions** — automatically, with humans only on the long tail.

```
✅ Auth gate            (PR #5)
✅ Embeddings + dedup + answer reuse   (PR #6)   ── A, B, C
✅ Confidence + auto-deflect           (PR #7)   ── D
✅ Feedback loop                       (PR #9)   ── E
✅ Knowledge base surface              (PR #12)  ── F
✅ Analytics                           (PR #13)  ── G
── Hardening track runs alongside (prod readiness)
```

---

## Dependency graph

```
Auth (#5) ─────────────────────────────► (gates everything; independent)

Embeddings/Dedup/Reuse (#6) ─┬─► Confidence/Auto-deflect (#7) ─┬─► Feedback (E) ─► better retrieval
                             │                                 │
                             ├─────────────────────────────────┴─► KB Surface (F)
                             └─► Analytics (G, partial without #7; full with it)

Hardening (tests, prod Docker, observability, rate-limit) ── parallel, no blockers
```

---

## Phases

### ✅ A–C. Semantic enrichment — PR #6 (done)
Embed each post, link to nearest prior tickets, reuse resolved answers in the agent.
**Files:** `lib/ai/embed.ts`, `lib/ai/related.ts`, `lib/db/queries/embeddings.ts`, schema side tables.

### ✅ D. Confidence + auto-deflect — PR #7 (done)
Reviewer pass grades each answer; high confidence → auto-answer, else human queue.
**Files:** `lib/ai/assess.ts`, `lib/db/queries/assessments.ts`, dashboard stats, ticket badges.

### ✅ E. Feedback loop  *(done)*
Capture whether an answer was good, feed it back into retrieval and thresholds.
- 👍/👎 Discord reaction collector in `bot/handlers.ts` → `/api/feedback` → `ticket_feedback` table.
- Staff 👍/👎 buttons on ticket detail page via `FeedbackButtons` + `submitFeedbackAction`.
- `getPriorAnswers` filters out negatively-rated tickets and orders by net score.
- Per-category deflection accuracy table on the Analytics page.
- **Files:** `bot/handlers.ts`, `app/api/feedback/route.ts`, `lib/db/queries/feedback.ts`, `components/tickets/feedback-buttons.tsx`, `app/actions/feedback.ts`, `app/(dashboard)/analytics/page.tsx`.

### ✅ F. Knowledge base surface — PR #12 (done)
Turn resolved answers into a durable, searchable asset instead of a weekly FAQ blob.
- `kb_articles` table: canonical Q + answer, embedding, source ticket(s), published flag.
- "Promote to KB" action on a resolved ticket.
- Semantic search page (reuse embedding + cosine infra) — staff first, public optionally.
- Agent retrieves from KB articles, not just raw prior tickets.
- **Files:** `app/(dashboard)/kb/page.tsx`, `lib/db/queries/kb.ts`, `components/tickets/promote-kb-button.tsx`.

### ✅ G. Analytics — PR #13 (done)
Prove ROI and drive the roadmap.
- Deflection rate (auto-answered ÷ total), trend over time.
- Trending topics via embedding clusters.
- Doc-gap report: resolved how-to tickets not yet in the KB.
- SLA attainment, time-to-first-response.
- Per-category deflection accuracy from 👍/👎 feedback.
- **Files:** `app/(dashboard)/analytics/page.tsx`, `lib/db/queries/analytics.ts`, `lib/analytics/roi.ts`.

---

## Hardening track (parallel — production readiness)

Run alongside feature phases; none block the others.

| Item | Why | Effort |
|------|-----|--------|
| ✅ **Resend email notifications** | alert admins/owners on new critical/high tickets, ticket resolved, SLA breach; `lib/email/send.ts`; skips silently when `RESEND_API_KEY` absent | S |
| ✅ **Embeddable chat widget** | public AI chat backed by KB + prior answers; `<script>` tag embed; per-IP rate limiter; `DefaultChatTransport` (AI SDK v6); `widget_token` per org | M |
| ✅ **Secret encryption** | AI API keys and bot tokens encrypted at rest via AES-256-GCM (`lib/crypto/tokens.ts`); `ENCRYPTION_KEY` env var (64-char hex); dev fallback stores plaintext when key absent (PR #35) | S |
| ✅ **Tests** | 53 unit tests (vitest): SLA status, cosine related, retry transient detection, rate limiter, AES-256-GCM round-trip; `pnpm test` / `pnpm test:coverage` (PR #34) | M |
| ✅ **Prod Docker** | multi-stage `Dockerfile` (`deps`→`build`→`runner`, no toolchain in final), non-root user, `docker-compose.prod.yml` with built image + named SQLite volume + no bind-mount, `bot:start` (no watch); dev compose targets `deps` stage | S |
| ✅ **Observability** | structured JSON logger (`lib/logger.ts`), exponential-backoff retry (`lib/retry.ts`), `after()` fully wrapped, push/email/SLA failures isolated; all `console.*` replaced (PR #31) | M |
| ✅ **Rate limiting + input caps** | per-org ingest rate limit (10/10min), per-import chunk + char caps, per-org KB ceiling, URL length cap; `lib/ratelimit.ts` | S |
| ✅ **Migrations — Postgres** | SQLite → Neon/Postgres via Drizzle ORM; `lib/db/migrate.ts`; `drizzle/` migrations; `DATABASE_URL` required (PR #30) | L |
| ✅ **Auth v2** | Discord + Google OAuth via Auth.js; `provisionUser` creates org on first login; shared-password system deleted (`lib/auth/token.ts`, `lib/auth/session.ts`); `STAFF_PASSWORD`/`SESSION_SECRET` no longer needed | M |
| ✅ **Node version** | `engines.node >= 20.9` + `.nvmrc` (20) | S |

---

## Recommended next order

1. ~~**E — Feedback loop.**~~ ✅ Done (PR #9).
2. ~~**G — Analytics.**~~ ✅ Done (PR #13).
3. ~~**F — KB surface.**~~ ✅ Done (PR #12).
4. ~~**Resend email notifications.**~~ ✅ Done (PR #18).
5. ~~**Embeddable chat widget.**~~ ✅ Done (this PR).
6. ~~**Hardening — rate-limit + input caps.**~~ ✅ Done (PR #26).
7. ~~**Hardening — Prod Docker.**~~ ✅ Done (PR #27).
8. ~~**Hardening — Observability.**~~ ✅ Done (PR #31).
9. ~~**Hardening — Postgres migration.**~~ ✅ Done (PR #30).
10. ~~**Auth v2 — OAuth.**~~ ✅ Done (feat/auth-v2 — Discord + Google + GitHub).
11. ~~**Tests.**~~ ✅ Done — 44 unit tests; `pnpm test`.
12. ~~**Secret encryption.**~~ ✅ Done (PR #35) — AI API keys + bot tokens encrypted at rest (AES-256-GCM).
13. ~~**Billing.**~~ ✅ Done (PR #36) — Stripe deflection-volume tiers; checkout + portal + webhook.
14. ~~**Public self-serve signup.**~~ ✅ Done (PR #37) — landing page at `/`, GitHub/Discord/Google OAuth signup, auto-org provisioning.
15. ~~**14-day trial.**~~ ✅ Done (PR #39) — card-required trial replaces free tier; trial countdown UI, trial-ended wall, Stripe `trial_period_days: 14`.
16. **Multi-tenant launch** — merge all PRs, set `STRIPE_*` + OAuth env vars, deploy to production.
17. **Tier 1 gaps** (low effort, high value) — see competitive gap track below.
18. **Tier 2 gaps** (medium effort) — escalation routing, CSAT, slash commands.
19. **Tier 3 gaps** (higher effort) — Telegram, email channel, outbound campaigns.

---

## Competitive gap track

> Research basis: Chatbase, Mava, eesel AI, Helply, CustomGPT, Botpress (June 2026).
> Gaps ordered by effort. Each = one branch + PR.

### Tier 1 — Low effort, high value

| # | Feature | Gap vs competitors | Effort | Notes |
|---|---------|-------------------|--------|-------|
| T1-1 | **Multi-language AI responses** | Mava: 100+ langs. Fini: 50+ langs. We: English only. | XS | Detect language of incoming message, inject `"Respond in the same language as the question"` into system prompt. Zero schema change. |
| T1-2 | **White-label widget** | Chatbase: paid add-on ($1,188/yr). We: always show branding. | XS | Check org plan tier in widget route; hide "Powered by AnswerLoops" footer on Pro+. Already have plan/billing infra. |
| T1-3 | **Source citations on AI answers** | CustomGPT cites source on every response. Builds trust, reduces hallucination perception. | S | Include KB article title + link at bottom of AI reply (`"Source: [article title]"`). Pass article metadata into prompt context. |
| T1-4 | **CSV export** | Standard competitive feature. We have data, no export. | S | Stream CSV from `/api/export/tickets` and `/api/export/leads`. Ticket columns: id, status, category, content, ai_summary, created_at. |
| T1-5 | **Lead capture in widget** | Chatbase: email capture built in. We: anonymous only. | S | Optional email field before chat starts. New `widget_leads` table (`org_id`, `widget_token`, `email`, `created_at`). Show in dashboard leads view. |

### Tier 2 — Medium effort, high value

| # | Feature | Gap vs competitors | Effort | Notes |
|---|---------|-------------------|--------|-------|
| T2-1 | **Knowledge gap dashboard** | Helply surfaces knowledge gaps explicitly. Mava: test questions in dashboard to find gaps. We: no dedicated view. | M | Query: tickets with low AI confidence + no KB match + no positive feedback. Surface as `/knowledge-gaps` page with "Create KB article" CTA per gap. |
| T2-2 | **Human escalation routing** | Mava, eesel AI, Alhena all have clean human handoff. We: low-confidence tickets sit in queue silently. | M | When confidence < threshold, post `@team` mention in original Discord/Slack thread + mark ticket `needs_human`. Config: per-org threshold + mention role ID. |
| T2-3 | **CSAT scoring** | Fini: conversation-level CSAT with smart survey triggers. Mava: satisfaction metrics. We: only 👍/👎. | M | After ticket resolved, post follow-up message in thread: "Was this helpful? Reply 1–5". Bot collects reply, stores in `ticket_csat`. Dashboard shows avg CSAT trend. |
| T2-4 | **Discord slash commands** | Competitors offer `/ask`, `/help`, `/summarize` slash commands. We: passive listener only. | M | Register `/ask [question]` and `/summarize` slash commands via Discord API. `/ask` triggers AI answer inline. `/summarize` condenses a thread into a bullet list. |
| T2-5 | **Simulation / dry-run mode** | eesel AI: run agent over past tickets before going live. Safety net before deploying changes. | M | Settings page option: "Test against last N tickets". Runs AI pipeline on historical tickets, shows what it would have answered vs actual resolution. No writes. |

### Tier 3 — Higher effort, strategic

| # | Feature | Gap vs competitors | Effort | Notes |
|---|---------|-------------------|--------|-------|
| T3-1 | **Telegram channel support** | Mava: Discord + Telegram + Slack + Web + Email. We: Discord + Slack + Web. Telegram is big in crypto/Web3 communities. | L | New `telegram_integrations` table. Telegraf bot SDK. Ingest pipeline same as Discord. |
| T3-2 | **Auto-retrain / KB sync** | Chatbase Standard: auto-retrain agents when source changes. We: manual KB updates only. | L | Cron or webhook re-ingests KB source URLs (docs site, GitHub wiki) on schedule. Diff-based: only re-embed changed pages. |
| T3-3 | **Outbound campaigns** | Chatbase Standard: outbound campaigns. Proactively message users based on segment. | L | Compose + schedule a message to a Discord role or Slack channel segment. Use cases: release notes, downtime alerts, changelog announcements. |
| T3-4 | **Email channel support** | Mava: email consolidated into shared inbox. We: no email ingest. | XL | Inbound email via Resend inbound or Postmark. Parse → ticket. Reply via email or Discord/Slack thread. Bidirectional thread linking. |
| T3-5 | **Custom automations / routing rules** | Mava: custom views & automations. Chatbase: AI Actions (trigger webhooks, lookups). We: static routing. | XL | Rule builder: if category = X and confidence < Y, then route to Z / tag / notify. No-code UI in Settings. |

---

## How a contributor picks up work

- Each phase = one focused branch + PR, stacked when dependent (see graph).
- Pattern established: side tables over `ALTER`; AI calls wrapped in try/catch; verify with `tsc --noEmit`, a clean `pnpm build`, and logic tests on a throwaway SQLite DB (`DB_PATH=$(mktemp)` + `tsx`).
- Keep `docs/ARCHITECTURE.md` current when the pipeline changes.
- Competitive gap track: start at T1-1 and work down. Each T1 item ships independently.
