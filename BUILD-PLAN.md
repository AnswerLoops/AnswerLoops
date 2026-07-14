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
✅ Hardening track                     (PRs #18–#39)
✅ Competitive gap T1 (all 5)          (PR #45)  ── H
✅ Competitive gap T2-1,2,3            (PR #46)  ── I
✅ T1 gaps + sim + UX hardening + docs (PR #51)  ── J
── T2-4 + T3 track in progress
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

## Email channel v2 — production spec (zero-setup inbound + reliability core + paid custom domain)

> Status: ✅ Phase A shipped (`feat/email-v2-inbound`). Phase B (custom domain, paid) not started — tier gate still TBD.
>
> Files: `lib/db/schema.ts` (`emailMessages` table, `integrations.inboundAddress`), `drizzle/0014_email_v2.sql`, `lib/db/queries/email-messages.ts`, `lib/db/queries/integrations.ts` (`getIntegrationByInboundAddress`), `lib/db/queries/tickets.ts` (`recordCustomerReply`), `lib/email/webhook-verify.ts`, `lib/email/inbound.ts`, `app/api/email/ingest/route.ts`, `lib/email/reply.ts`, `lib/ai/agent.ts` (ticketId threaded through `postReply`), `app/actions/integrations.ts` (`connectPlatformEmailAction`), `app/(dashboard)/settings/page.tsx`, `app/onboarding/wizard.tsx`, `app/(dashboard)/tickets/[id]/page.tsx`, `docs/self-hosting/email-channel.mdx`, `docs/reference/environment-variables.mdx`, `docs/self-hosting/environment-variables.mdx`, `tests/unit/email-v2-inbound.test.ts`, `tests/unit/email-v2-webhook-verify.test.ts`, `tests/unit/email-v2-infra.test.ts`.
>
> Known deviation from this spec: A2.7 said threading matches should notify staff and NOT auto-rerun the AI agent (loop-risk minimization) — implemented exactly as specified in the shipped code, despite an initial draft that re-ran the agent; caught and corrected before merge.
>
> Deferred, not in this PR: A6 per-org sending subdomains (deliverability isolation), full attachment content ingestion into AI context (metadata only is stored), `e2e/email.spec.ts` (no e2e harness for this endpoint yet — covered by structural + real unit tests in `tests/unit/email-v2-*.test.ts` instead), Phase B custom domain branding.
> Product requirements, verbatim: **usable without extra setup from users** (orgs never touch a mail provider, DNS, webhooks, or secrets) and **reliable** (defined concretely in "Reliability contract" below).

### Why

Every other channel is 1-click: Discord (shared bot, OAuth), Slack (shared app, OAuth or polling), GitHub (App install). Email is the only channel that requires the org to already have a SendGrid/Mailgun/Postmark/Cloudflare account, own a domain, and manually wire an inbound webhook + copy a secret header before anything works (see `docs/self-hosting/email-channel.mdx`). For a self-serve funnel aimed at thousands of signups, nobody finishes that flow cold.

Outbound already has no per-org setup: every org's AI replies go out through the platform's shared `RESEND_API_KEY` (`lib/email/send.ts`, `lib/email/reply.ts`). The gap is inbound. The fix used by every comparable tool (Help Scout, Front, Intercom, Zendesk): the platform owns inbound routing, and every org gets a working address instantly.

### Reliability contract (what "reliable" means, testably)

1. **No silently lost email.** Every message accepted by the receiving domain either becomes a ticket, attaches to an existing ticket, or is rejected for an explicit, logged, staff-visible reason (spam score, loop guard, sender filter, size cap). "Dropped with only a server log line" is the failure mode this codebase has been bitten by twice already (Discord zero-channels, KB partial imports) — not acceptable here.
2. **No duplicate tickets from webhook retries.** Provider webhooks retry on timeout/5xx; every retry of the same message must be idempotent.
3. **Conversation threading.** A customer replying to an AI answer continues the SAME ticket. Today every reply spawns a fresh ticket (inbound has a new `Message-ID`; nothing matches `In-Reply-To`/`References` back to the original). This is the single biggest usability defect in the current channel and is REQUIRED for v2, not optional polish.
4. **No mail loops.** The AI must never auto-reply to an auto-responder (out-of-office, bounce notices, no-reply@ senders). One vacation responder pointed at the inbound address must not generate an infinite ticket/reply loop that burns AI spend.
5. **Delivery failures are visible.** If the AI's reply bounces or fails to send, staff see it on the ticket — a ticket must not look "answered" when the customer never received anything.
6. **Fast webhook ack.** The ingest endpoint 200s quickly and does heavy work async. Today `processCommunityMessage` awaits a triage LLM call BEFORE returning — under provider webhook timeouts that means retries, and retries + slow path = wasted duplicate LLM spend even with idempotent dedup. Move ticket-creation-critical work behind an immediate ack (persist raw message → 200 → process).
7. **Cost-bounded.** Rate limits + size caps + spam gating in front of every AI call, same standard the widget-chat endpoint got this cycle.

### Provider decision: Resend Inbound (both directions, one vendor)

Resend now ships inbound email natively (`email.received` webhook; payload includes `from`, `to`, `cc`, `bcc`, `received_for`, `subject`, `message_id`, and parsed **attachments**; webhook signature verification built in; messages are stored by Resend even if the webhook endpoint is down — a retry/replay safety net that a hand-rolled receiver wouldn't have). Since Resend is already the outbound provider, this gives one vendor and one domains API serving Phase A (receiving domain) and Phase B (custom outbound domains). Verify exact payload field names (esp. spam/DMARC verdict fields) against current Resend docs at implementation time.

### Phase A — zero-setup inbound + reliability core (free, all plans; ONE PR-sized track, ~1.5–2 weeks)

**User-visible result:** connecting Email in onboarding or Settings instantly shows a working address — `{org-slug}-{short-random}@inbox.answerloops.com` — with a copy button and 2-minute "forward your existing support address here" instructions (Gmail / Google Workspace / Outlook variants). No provider account, no DNS, no webhook, no secret. Random suffix prevents slug-squatting and address-guessing; address is immutable after creation.

**A1. Data model** (migration `NNNN_email_v2.sql`):
- `integrations` (email row): `inbound_address TEXT UNIQUE`.
- New table `email_messages` — the raw-inbound persistence + idempotency + threading spine:
  `id`, `org_id`, `direction` ('in'|'out'), `rfc_message_id TEXT UNIQUE` (the RFC 5322 Message-ID — NOT Resend's API id; that distinction is why threading is broken today), `in_reply_to TEXT`, `references TEXT`, `ticket_id`, `from_addr`, `to_addr`, `subject`, `spam_verdict`, `status` ('received'|'processed'|'rejected_spam'|'rejected_loop'|'rejected_filter'|'sent'|'bounced'|'delivery_failed'), `raw_payload JSONB`, `created_at`.
- `tickets`: no schema change needed — threading resolves through `email_messages.ticket_id`.

**A2. Inbound flow** (`app/api/email/ingest/route.ts` rework):
1. Verify Resend webhook signature (built-in scheme; replaces hand-rolled shared secret for the platform path). Existing BYO per-org `X-Email-Webhook-Secret` path stays untouched for self-hosters — additive change.
2. Resolve org: match `received_for`/`to` against `integrations.inbound_address` (new `getIntegrationByInboundAddress`, org-scoped like everything post-tenant-isolation).
3. **Idempotency:** insert into `email_messages` keyed on `rfc_message_id`; on conflict, 200 and stop. This also supersedes reliance on the tickets-table dedup for retries.
4. **Ack fast:** 200 immediately after persistence; everything below runs in `after()` (triage moves inside it too — the one structural change to `processCommunityMessage`'s contract for this caller).
5. **Guards, in order (each rejection sets `email_messages.status` + creates a staff-visible notification when non-obvious):**
   - Loop guard: `Auto-Submitted != no`, `Precedence: bulk|auto_reply|junk`, `X-Auto-Response-Suppress`, empty Return-Path, or sender matching `no-reply@|noreply@|mailer-daemon@|postmaster@` → reject_loop. Plus a per-sender reply throttle (max N AI replies per sender per hour) as the backstop for headerless auto-responders.
   - Spam gate: provider spam/DMARC verdict above threshold → reject_spam (queue-for-review notification, not silent).
   - Sender allowlist (existing feature, unchanged).
   - Size cap: body truncated to a max char budget before any LLM call; oversize noted on ticket.
   - Rate limits (`lib/ratelimit.ts`): per-inbound-address and per-sender buckets.
6. **HTML fallback:** current route reads only `text`/`plain` — HTML-only email becomes empty content and silently dies. Add html→text conversion fallback before the length check.
7. **Threading resolution (the core new logic):** walk inbound `In-Reply-To` + `References` against `email_messages.rfc_message_id` (both directions' rows). Match → append to that ticket: store content as a community follow-up (new `ticket_event` type `customer_reply` + notification; reopen ticket if resolved/closed; do NOT auto-rerun the agent in v1 — staff notification instead, keeps loop-risk surface minimal). No match → new ticket via existing pipeline. Subject-line `Re:`-matching is explicitly NOT used as a fallback (false-positive merges across customers are worse than a rare split thread).
8. **Attachments:** persist metadata (filename, size, content-type, Resend reference) on `email_messages.raw_payload` and show on the ticket ("2 attachments — view in Resend" level). Full content ingestion into AI context = explicitly out of scope for v2.

**A3. Outbound flow** (`lib/email/reply.ts` rework):
- Subject: `Re: {original subject}` (from the persisted inbound row), never the current hardcoded string.
- Headers: set BOTH `In-Reply-To` and full `References` chain (append our prior Message-IDs) — required for Gmail conversation grouping.
- Persist our outbound RFC Message-ID into `email_messages` (direction 'out') — this is what makes step A2.7 able to match customer replies. Requires fetching/setting the actual Message-ID header (Resend API id ≠ Message-ID; confirm retrieval mechanism, or set an explicit `Message-ID` header ourselves at send time — simplest reliable option).
- From resolution: org custom domain (Phase B, if verified) → org inbound address → platform `RESEND_FROM`.

**A4. Delivery-failure visibility:**
- Subscribe to Resend outbound webhooks (`email.bounced`, `email.delivery_failed` etc.) on the existing webhook endpoint (same signature verification), update the matching `email_messages` row, surface a red "Reply not delivered" indicator + notification on the ticket. Closes contract item 5.

**A5. UI:**
- Settings → Email: assigned address + copy button + forwarding instructions replace the secret/provider flow. Existing allowed-senders / escalation / threshold fields unchanged. BYO path collapses into an "Advanced: bring your own provider" disclosure.
- Onboarding wizard Email step: shows the live assigned address at connect (currently a static "set it up later in Settings" card — the zero-setup promise has to be visible at signup, matching Discord/Slack).
- Ticket detail: customer follow-ups timeline (from `customer_reply` events), attachment list, delivery-failure indicator.

**A6. Deliverability posture (before real volume, may trail the initial ship by days, not weeks):**
- Per-org sending subdomains via Resend domains API so one org's spam complaints can't poison every org's deliverability. Shared flat domain is acceptable for launch week, not for scale.

### Phase B — custom domain branding (**paid upgrade**, tier gate TBD — owner decision; mirrors white-label-widget precedent; ~1 week, independent of Phase A)

Unchanged from prior draft, summarized: org on the gated plan verifies their own domain (Resend domains API — SPF TXT + DKIM CNAME shown in Settings, "Verify" polls status), after which AI replies send as `support@theircompany.com`. Outbound branding only — inbound stays via the Phase A forward (no MX delegation in v1). Server-side plan gate in the action (`lib/billing/plans.ts`), not just hidden UI. Also fixes the existing latent bug where the free-text "Reply-from address" field accepts unverifiable domains that Resend will refuse to send from. DB: `custom_domain`, `custom_domain_verified_at` on the email integration row.

### What the platform owner must do (one-time, ~30 min — the only human steps in the whole build)

1. Create receiving domain (`inbox.answerloops.com`) in Resend dashboard; enable inbound.
2. Add the MX/verification records in Cloudflare DNS.
3. Point Resend's `email.received` (+ outbound event) webhooks at `https://answerloops.com/api/email/ingest`; copy the webhook signing secret into a new Railway env var (`RESEND_WEBHOOK_SECRET`) on the app service.
4. Send one real end-to-end test email post-deploy.

### Testing

- Unit (structural + logic): guard-chain ordering, loop-header detection table, threading resolution (match via In-Reply-To, match via References chain, no-match → new ticket, cross-org non-match), idempotent replay of identical `rfc_message_id`, HTML fallback, subject echo, References construction.
- e2e (`e2e/email.spec.ts` — currently doesn't exist at all): POST realistic Resend-shaped payloads under `MOCK_EXTERNALS` — new ticket, threaded reply, spam reject, loop reject, webhook retry idempotency, oversized body.
- Failure-mode table in the PR description mapping each reliability-contract item → the test that pins it.

### Rollout

1. Phase A behind the platform env vars being present (absent → Settings shows the current BYO flow only; no breakage for self-hosters).
2. Ship → owner does the 4 external steps → live verification → flip onboarding wizard step.
3. Phase B after the tier-gate decision.

### Docs impact when this ships

- Rewrite `docs/self-hosting/email-channel.mdx` into hosted quickstart (zero-setup) + self-hosting/BYO path (current content preserved).
- `docs/reference/billing-plans.mdx` — custom domain under its gated tier (Phase B).
- Notion: Build Plan, Architecture (email_messages table + threading design), Business Value (monetizable Phase B), Production Setup Guide (`RESEND_WEBHOOK_SECRET`, Resend inbound + Cloudflare steps), Multi-Tenant SaaS Plan (per-org inbound address pattern alongside widget-token/guild-id patterns).

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
16. ~~**Multi-tenant launch.**~~ ✅ Done — PRs merged, OAuth + billing live.
17. ~~**Tier 1 gaps (all 5).**~~ ✅ Done — PR #45 (multi-language, white-label, citations, CSV export, lead capture).
18. ~~**T2-1 Knowledge gap dashboard.**~~ ✅ Done — PR #46.
19. ~~**T2-2 Human escalation routing.**~~ ✅ Done — PR #46.
20. ~~**T2-3 CSAT scoring.**~~ ✅ Done — PR #46.
21. **T2-4 Discord slash commands** — `/ask` + `/summarize` via Discord Interactions API.
22. ~~**T2-5 Simulation / dry-run mode**~~ ✅ Done — replay last N tickets through AI pipeline, no writes. `/simulation` page with model/threshold picker and per-ticket confidence + deflect comparison.
23. ~~**Mintlify docs scaffold**~~ ✅ Done (PR #51) — 44 pages in `/docs`; live at `answerloops.mintlify.app`; covers self-hosting, product guide, integrations, reference.
24. **Tier 3 gaps** — Telegram, auto-retrain, outbound campaigns, email channel, custom automations.
25. ~~**Multi-tenant isolation hardening.**~~ ✅ Done — `fix/tenant-isolation`. Org scoping enforced across GitHub repo queries/tools, push notifications, related-ticket links, SLA breach checks, and ticket lookups; IDOR fixes on repo delete and ticket routes/actions; `tests/unit/tenant-isolation.test.ts` + `tests/unit/tenant-isolation-regressions.test.ts` pin every fix.
26. ~~**KB-only agent mode.**~~ ✅ Done — `feat/kb-grounded-agent`. Agent no longer skips orgs with zero GitHub repos; runs without code-search tools, grounded on KB context + prior resolved answers, with a no-hallucination instruction. Confidence reviewer still gates auto-deflection. `tests/unit/kb-only-agent.test.ts`.
27. ~~**Explicit orgId everywhere.**~~ ✅ Done — `fix/require-explicit-org-id`. Every `orgId = DEFAULT_ORG_ID` default parameter removed from `lib/`; compiler surfaced 28 unscoped call sites (analytics page/API, dashboard, layout unread count, FAQ routes, tickets API, notification actions) that were serving org 1's data to every tenant. `tests/unit/no-default-org.test.ts` bans the pattern permanently; `tests/unit/org-scoped-boundaries.test.ts` pins each boundary.
28. ~~**KB URL import: rate-limit-safe batching + honest partial-completion reporting.**~~ ✅ Done — `fix/kb-url-ingest-firecrawl`. Site imports now send exactly one batch-scrape request per import (the import service rate-limits by request, not by page — splitting into several calls would use more of that budget, not less), with a conservative internal concurrency cap. If the call fails or returns fewer pages than requested, the result reports `pagesFound`/`incomplete` and the KB page tells the user to re-run the import instead of claiming full success (already-ingested pages are skipped on retry). User-facing errors no longer name the upstream vendor. `tests/unit/kb-url-ingest-batching.test.ts`.
29. ~~**Discord onboarding: channel picker on 1-click OAuth return.**~~ ✅ Done — `fix/discord-onboarding-channel-picker`. The 1-click Discord OAuth path in onboarding jumped straight from Connect to Seed KB after the bot joined the server, never asking which channels to monitor — `bot/handlers.ts` only forwards messages whose channel is in the integration's `channel_ids`, which the OAuth callback never set, so every message the bot saw was silently dropped with no user-visible signal (only a server log line). Fix: the callback now passes `guild_id` back to the onboarding redirect, and the wizard lands directly on the same channel picker Settings already uses (fetching channels via the platform-bot-token endpoint, no per-org token needed) before letting the user continue. `tests/unit/discord-onboarding-channel-picker.test.ts`.
30. ~~**Widget abuse hardening.**~~ ✅ Done — `fix/widget-abuse-hardening`. Public `/api/widget/chat` endpoint now reuses the shared `lib/ratelimit.ts` limiter (was a duplicate hand-rolled Map) with two buckets — per widget-token (100/min, caps cost exposure per org regardless of IP) and per token+IP (20/min, catches a single abusive visitor); adds a 4,000-char per-message cap and 50-message per-request cap enforced before the model call. `tests/unit/widget-abuse-hardening.test.ts` + new e2e cases in `e2e/widget.spec.ts`.
31. ~~**Onboarding "Go to dashboard" button hangs forever.**~~ ✅ Done — `fix/onboarding-finish-redirect`. The Go Live step's finish button called `completeOnboardingAction` directly from a client `onClick` handler, and that action ended with `redirect('/dashboard')`. `redirect()`'s throw-based navigation is only intercepted when Next.js dispatches a server action itself (e.g. a `<form action={...}>` submission, the pattern every other redirect-throwing action in this app already uses — logout, invitation accept); called as a bare manual function invocation, the thrown error never reached the browser, so the awaited call never resolved the way the UI expected and the button stuck on "Loading dashboard…" indefinitely. Fix: the action no longer calls `redirect()` — it does the DB writes and returns a plain `{ error? } | null` result; the client calls `router.push('/dashboard')` after the awaited call resolves, and surfaces an error message instead of hanging if it fails. Tests: `tests/unit/onboarding-finish-redirect.test.ts`.
32. ~~**Dashboard topnav collapses to the left edge on desktop.**~~ ✅ Done — `fix/dashboard-topnav-flex-collapse`. User reported the notification dropdown rendering clipped/mostly off-screen; live-reproduced with a seeded local Postgres + dev server + Playwright screenshots across viewport widths 375–1600px. Root cause was one level deeper than the dropdown: the topnav header used `justify-content: space-between` between the mobile drawer trigger and the utility cluster (Website link / bell / Sign out), but the trigger is `md:hidden` (`display:none`) at desktop widths — and a `display:none` element is excluded from flex layout entirely, leaving only one flex child. `space-between` with a single item degenerates to `flex-start`, so the whole cluster collapsed to the header's left edge at every desktop width (900–1600px, confirmed identical pinned pixel position regardless of viewport). That put the bell close enough to the sidebar boundary that its dropdown (`right-0`, 256px wide) intruded into the sidebar's column and got clipped by an `overflow-hidden` ancestor — the dropdown clipping was a symptom, not the root bug. Fix: `ml-auto` on the utility cluster instead of `justify-between` on the header — doesn't depend on sibling count or visibility, so it can't regress the same way if the trigger's visibility logic changes again. Tests: `tests/unit/dashboard-topnav-flex.test.ts`.
33. ~~**T3-4 Email channel v2 — zero-setup inbound + reliability core.**~~ ✅ Done — `feat/email-v2-inbound`. Replaces the BYO-provider-only email channel (which required every org to own a SendGrid/Mailgun/Postmark account before email worked at all) with a platform-hosted path: one click generates a working `{org-slug}-{random}@inbox.answerloops.app` address, no provider account/DNS/webhook/secret required. Also fixes the underlying reason email conversations never threaded correctly — outbound sends only ever persisted Resend's internal API id, never the RFC 5322 `Message-ID` a customer's reply actually references — by adding an `email_messages` idempotency/threading table keyed on `rfc_message_id`, and setting real `Message-ID`/`In-Reply-To`/`References` headers on every outbound send. Adds a mail-loop guard chain (Auto-Submitted/Precedence/suppress headers + no-reply sender patterns + a per-sender reply throttle backstop), spam-verdict gating (fail-open), HTML-to-text fallback, per-org rate limiting, and delivery-status tracking (bounced/complained/delayed) surfaced as a badge on the ticket detail page. The BYO-provider path is preserved unchanged as an "Advanced" option for self-hosters who need a custom sending domain. Tests: `tests/unit/email-v2-inbound.test.ts`, `tests/unit/email-v2-webhook-verify.test.ts`, `tests/unit/email-v2-infra.test.ts`.

---

## Competitive gap track

> Research basis: Chatbase, Mava, eesel AI, Helply, CustomGPT, Botpress (June 2026).
> Gaps ordered by effort. Each = one branch + PR.

### Tier 1 — Low effort, high value

| # | Feature | Gap vs competitors | Effort | Status |
|---|---------|-------------------|--------|--------|
| T1-1 | **Multi-language AI responses** | Mava: 100+ langs. Fini: 50+ langs. We: English only. | XS | ✅ PR #45 — system prompt language injection, agent + widget |
| T1-2 | **White-label widget** | Chatbase: paid add-on ($1,188/yr). We: always show branding. | XS | ✅ PR #45 — Pro+ hides "Powered by AnswerLoops" footer |
| T1-3 | **Source citations on AI answers** | CustomGPT cites source on every response. Builds trust, reduces hallucination perception. | S | ✅ PR #45 — `📚 Source: [title]` appended to widget answers |
| T1-4 | **CSV export** | Standard competitive feature. We have data, no export. | S | ✅ PR #45 — `/api/export/tickets` + `/api/export/leads`; download buttons in dashboard |
| T1-5 | **Lead capture in widget** | Chatbase: email capture built in. We: anonymous only. | S | ✅ PR #45 — email gate before chat; `widget_leads` table; `/leads` dashboard page |

### Tier 2 — Medium effort, high value

| # | Feature | Gap vs competitors | Effort | Status |
|---|---------|-------------------|--------|--------|
| T2-1 | **Knowledge gap dashboard** | Helply surfaces knowledge gaps explicitly. Mava: test questions in dashboard to find gaps. We: no dedicated view. | M | ✅ PR #46 — `/knowledge-gaps` page; low-confidence + missing KB + needs-human tickets; category bar chart |
| T2-2 | **Human escalation routing** | Mava, eesel AI, Alhena all have clean human handoff. We: low-confidence tickets sit in queue silently. | M | ✅ PR #46 — `@role` mention in Discord/Slack thread on low confidence; per-org threshold + role ID in Settings |
| T2-3 | **CSAT scoring** | Fini: conversation-level CSAT with smart survey triggers. Mava: satisfaction metrics. We: only 👍/👎. | M | ✅ PR #46 — 1️⃣–5️⃣ reaction prompt after auto-deflect; `csat_ratings` table; avg + breakdown on Analytics |
| T2-4 | **Discord slash commands** | Competitors offer `/ask`, `/help`, `/summarize` slash commands. We: passive listener only. | M | ⬜ Next |
| T2-5 | **Simulation / dry-run mode** | eesel AI: run agent over past tickets before going live. Safety net before deploying changes. | M | ✅ Done |

### Tier 3 — Higher effort, strategic

| # | Feature | Gap vs competitors | Effort | Notes |
|---|---------|-------------------|--------|-------|
| T3-1 | **Telegram channel support** | Mava: Discord + Telegram + Slack + Web + Email. We: Discord + Slack + Web. Telegram is big in crypto/Web3 communities. | L | New `telegram_integrations` table. Telegraf bot SDK. Ingest pipeline same as Discord. |
| T3-2 | **Auto-retrain / KB sync** | Chatbase Standard: auto-retrain agents when source changes. We: manual KB updates only. | L | Cron or webhook re-ingests KB source URLs (docs site, GitHub wiki) on schedule. Diff-based: only re-embed changed pages. |
| T3-3 | **Outbound campaigns** | Chatbase Standard: outbound campaigns. Proactively message users based on segment. | L | Compose + schedule a message to a Discord role or Slack channel segment. Use cases: release notes, downtime alerts, changelog announcements. |
| T3-4 | **Email channel support** | Mava: email consolidated into shared inbox. We: no email ingest. | XL | ✅ Done — `feat/email-v2-inbound`. Zero-setup platform-hosted inbound address + Resend Inbound webhook, real RFC threading, reliability guard chain. Phase B (custom domain, paid) not started. |
| T3-5 | **Custom automations / routing rules** | Mava: custom views & automations. Chatbase: AI Actions (trigger webhooks, lookups). We: static routing. | XL | Rule builder: if category = X and confidence < Y, then route to Z / tag / notify. No-code UI in Settings. |

---

## How a contributor picks up work

- Each phase = one focused branch + PR, stacked when dependent (see graph).
- Pattern established: side tables over `ALTER`; AI calls wrapped in try/catch; verify with `tsc --noEmit`, a clean `pnpm build`, and logic tests on a throwaway SQLite DB (`DB_PATH=$(mktemp)` + `tsx`).
- Keep `docs/ARCHITECTURE.md` current when the pipeline changes.
- Competitive gap track: start at T1-1 and work down. Each T1 item ships independently.
