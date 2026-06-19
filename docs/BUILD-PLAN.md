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
| ✅ **Tests** | 44 unit tests (vitest): SLA status, cosine related, retry transient detection, rate limiter; `pnpm test` / `pnpm test:coverage` | M |
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
12. ~~**Billing.**~~ ✅ Done — Stripe deflection-volume tiers; checkout + portal + webhook.
13. ~~**Public self-serve signup.**~~ ✅ Done — landing page at `/`, GitHub/Discord/Google OAuth signup, auto-org provisioning.
14. **Multi-tenant launch** — merge all hardening PRs, set `STRIPE_*` + OAuth env vars, deploy to production.

---

## How a contributor picks up work

- Each phase = one focused branch + PR, stacked when dependent (see graph).
- Pattern established: side tables over `ALTER`; AI calls wrapped in try/catch; verify with `tsc --noEmit`, a clean `pnpm build`, and logic tests on a throwaway SQLite DB (`DB_PATH=$(mktemp)` + `tsx`).
- Keep `docs/ARCHITECTURE.md` current when the pipeline changes.
