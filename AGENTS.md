<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# No shortcuts

Never cut corners. Implement everything fully and correctly.

- No placeholder implementations, stubs, or half-finished features
- No workarounds when the proper fix exists
- No bypassing safety checks, migration steps, or validation
- No suggesting a "quick fix" instead of the real solution
- If something is hard, do it right anyway

# Commit message rules

Every commit **must** have a subject line AND a body. No exceptions.

- **Subject line** (≤72 chars): `<type>: <what changed>` — e.g. `fix: await createArticle so articles persist`
- **Body**: explain WHY the change was made and WHAT problem it solves. At least 2–3 sentences. Include the root cause for bug fixes, the user value for features, and any non-obvious context a future reader needs.
- **Never** add `Co-Authored-By`, `Claude`, or any AI attribution trailer.

Example:
```
fix: await createArticle so KB URL imports persist

createArticle was called without await in saveChunks(), meaning the DB
write raced with the response. The success count was accurate but the
rows were never committed, causing articles to vanish on page reload.
```

PRs must also have a meaningful description — not "No description provided."

# PR description standard — HARD RULE

Every PR description must be written as if a human engineer who was **not in this conversation** will review it cold.

**Required sections:**

```
## What changed
One paragraph. Plain English. What is different after this PR merges?
No bullet dumps of commit messages. No "implemented the requested changes."

## Why
One paragraph. Root cause for fixes. User value for features. Business
reason for refactors. If the why is obvious (typo fix), one sentence is fine.

## How to test
Numbered steps a reviewer can actually follow. Include any env vars or
setup needed. At minimum: what to run, what to look for, what failure looks like.
```

**Banned phrases** — any PR containing these will be rejected:

- "No description provided"
- "Implemented the requested changes"
- "Updated the code as discussed"
- "See commit messages for details"
- "Various fixes and improvements"
- "As per the conversation"

**Tone:** write like a colleague, not a changelog. Contractions OK. "I fixed" OK. Bullet points OK inside sections. No corporate fluff.

# Docs + Notion sync

Every time a feature ships or architecture changes, you **must** update all three:

1. **Mintlify docs** — update or create the relevant `.mdx` page(s) in the `docs/` folder of this repo (Mintlify reads from `docs/` — there is no separate repo)
2. **Notion docs map** — update the status table and any affected rows (page ID in AGENTS.md Notion table)
3. **Notion architecture/build-plan pages** — per the mapping table in "Build plan hygiene" below

| What changed | Docs pages to update |
|---|---|
| New feature | Relevant product guide page + What is AnswerLoops intro if it changes the value prop |
| New integration | integrations/<name>.mdx + self-hosting guide if setup is required |
| New env var | self-hosting/environment-variables.mdx + reference/environment-variables.mdx |
| Schema / data model change | reference/data-model.mdx |
| API endpoint added/changed | reference/api-endpoints.mdx |
| Billing / plan change | product/billing.mdx + reference/billing-plans.mdx |
| Architecture change | reference/data-model.mdx + self-hosting pages as needed |

Docs are in the `docs/` folder of this repo. Notion docs map: `$NOTION_DOCS_MAP_ID` (see `.env.notion`).

# Mintlify docs — architectural change rule

Any change to how the system works at a pipeline, infrastructure, or integration level **must** update the relevant Mintlify `.mdx` page(s) in `answerloops-docs` in the same PR. This is not optional.

Architectural changes include (but are not limited to):
- New or replaced background jobs, polling loops, listeners, queues
- Changes to how config is loaded, cached, or hot-reloaded
- New DB tables, triggers, or migrations that affect system behavior
- New or changed API contracts between services (bot ↔ app, widget ↔ app)
- Changes to deployment topology (new service, new env var, new container)
- New or changed external service integrations (Discord, Slack, AI providers, etc.)

For each architectural change, identify the affected docs pages from the table above and update them before the PR is opened. If no existing page covers the change, create one.

# Infra-test skill — automated tests on every infrastructure change

On any PR that includes an infrastructure change, run `/project:infra-test` **before** opening the PR.

The skill deploys a subagent to:
1. Identify every changed infra file (DB migrations, bot, API routes, Docker, compose, schema)
2. Write vitest/Playwright tests covering the change — placed in `tests/unit/` or `e2e/`
3. Document the new tests in Notion (Claude Rules & Checks changelog + Build Plan entry)
4. Add a "Tests added" section to the PR body
5. Commit the test files to the branch

The orchestrator (main Claude) then:
- Runs `pnpm test` and verifies all new tests pass
- Reviews that tests would actually catch a regression
- Sends weak tests back to the subagent with specific instructions
- Signs off with an `INFRA-TEST SIGN-OFF` block before the PR is created

**Infrastructure changes** include: DB migrations/triggers, bot changes, new API routes, Docker/compose changes, new env vars, new external service integrations.

# Mobile-check skill — automated responsive audit on every UI change

On any PR that adds or changes UI (`app/**/*.tsx`, `components/**/*.tsx`, `app/globals.css`, or shared layout shells), run `/project:mobile-check` **before** opening the PR.

The skill deploys a subagent to:
1. Audit the diff's changed UI files for mobile-responsive breakage at a 375px viewport (fixed widths, non-wrapping flex rows, un-scrollable tables, nav items hidden with no drawer fallback)
2. If issues are found, deploy a second subagent that fixes them using Tailwind responsive prefixes only — no new dependencies

The orchestrator (main Claude) then:
- Reviews that each flagged issue was actually fixed
- Verifies the changed page in-browser at a 375px viewport (per the UI testing rule above)
- Runs `pnpm build` to confirm no regressions
- Signs off with a `MOBILE-CHECK SIGN-OFF` block before the PR is created

If the diff touches no UI files, skip the skill entirely.

# Component-test skill — automated test coverage on every component logic change

On any PR that adds or meaningfully changes a component with real logic (`useState`, `useEffect`, `useActionState`, event handlers, conditional rendering — not markup-only edits), run `/project:component-test` **before** opening the PR. This is separate from `/project:mobile-check`, which audits and fixes responsiveness but never writes tests, and from `/project:infra-test`, which is scoped to DB/bot/API/Docker changes only — none of the three overlap.

The skill deploys a subagent to:
1. Identify every changed component file that qualifies (has logic, not just styling)
2. Write `@testing-library/react` + `happy-dom` component tests covering that behavior, placed in `tests/unit/*.test.tsx`
3. Add a "Component tests added" section to the PR body
4. Commit the test files to the branch

The orchestrator (main Claude) then:
- Runs `pnpm test` and verifies all new tests pass
- Reviews that tests cover real behavior (state transitions, conditional rendering, event handling), not just static markup
- Sends weak tests back to the subagent with specific instructions
- Signs off with a `COMPONENT-TEST SIGN-OFF` block before the PR is created

If the diff touches no component files with real logic, skip the skill entirely.

Diff mode only ever sees the current PR's changed files, so it can't surface pre-existing gaps (components shipped before this skill existed). Run `/project:component-test --full` periodically — not on every PR — to scan all of `components/**/*.tsx` for logic-bearing files with no matching test and report gaps for triage before backfilling.

# Notion leak prohibition — HARD RULE

**Never include Notion page IDs, workspace URLs, or any `notion.so` / `app.notion.com` links in:**

- Commit messages (subject or body)
- PR titles or PR bodies
- Branch names
- Code or documentation committed to the repo — **except `AGENTS.md`**

Notion page IDs live in `.env.notion` — gitignored, never committed. `AGENTS.md` contains only variable names (`$NOTION_*`), not literal IDs. All other committed files are prohibited from containing IDs. Notion workspace structure must never appear in the public git history or GitHub UI.

# Subagent concurrency limit

**Maximum 4 subagents running at any given time.** No exceptions.

- If a task requires more than 4 subagents, queue the extras and launch them as slots free up
- Never spawn a 5th subagent while 4 are still running — concurrent conflicts corrupt shared state (git, DB, Notion pages)
- When queuing: finish and verify each batch of ≤4 before spawning the next
- This applies to both Agent tool calls and `/project:infra-test` subagent spawns

# Claude rules check on every PR

Before opening any PR, re-read this file (`AGENTS.md`) and verify all rules are satisfied:

0. `docs/BUILD-PLAN.md` updated — phase marked ✅, files list updated, Recommended next order updated
1. Commit has subject + body (no AI attribution)
2. Mintlify docs updated in `docs/` folder for any feature/architecture change
3. All required Notion pages updated per the mapping tables
4. `- [x] Notion updated` checkbox ticked in PR body
5. `pnpm test` + `pnpm build` both pass
6. PR description passes the "PR description standard" — has What changed / Why / How to test, no banned phrases
7. If infra changed: `/project:infra-test` ran and orchestrator signed off
8. If UI changed: `/project:mobile-check` ran and orchestrator signed off
9. If a component with real logic changed: `/project:component-test` ran and orchestrator signed off
10. No Notion page IDs, URLs, or internal links in commit messages, PR bodies, or code (AGENTS.md excepted)

# PR creation rule — HARD REQUIREMENT

When creating a PR with `gh pr create`, you **must** do the following IN ORDER. No exceptions, no skipping:

1. Update all required Notion pages via `mcp__notion__notion-update-page` (see mapping table below)
2. Tick the `- [x] Notion updated` checklist item in the PR body before submitting
3. Only then run `gh pr create`

**Never create the PR first and update Notion later.** Notion sync happens before `gh pr create` runs. If the session ends before the PR is created, the Notion update has already been done. If the Notion update fails, fix it before creating the PR.

# Build plan hygiene

After completing any phase or significant feature, do ALL of the following before opening the PR:

1. Mark it `✅` in `docs/BUILD-PLAN.md` and update the files list.
2. Update the "Recommended next order" section in `docs/BUILD-PLAN.md`.
3. Push to Notion — **every PR must update at minimum: Build Plan + Architecture (main) + Production Setup Guide**. Additional pages per the table below:

| What changed | Pages to update |
|---|---|
| Any PR (minimum) | Build Plan · Architecture (main) · Production Setup Guide |
| New feature shipped | Build Plan · Architecture (main) · Business Value · Production Setup Guide |
| New AI/LLM capability | Build Plan · Architecture · Business Value · Competitive Analysis · Production Setup Guide |
| New integration or channel | Build Plan · Architecture · Multi-Tenant SaaS Plan · Production Setup Guide |
| Env var added/changed | Production Setup Guide |
| Pricing / moat / positioning shift | Business Value · Competitive Analysis |
| Schema / data model change | Architecture (data model section) |
| Deployment change | Architecture (deployment section) · Production Setup Guide |

Notion page IDs — stored in `.env.notion` (gitignored, never committed).
Read `.env.notion` at the start of any PR workflow to resolve these variable names:

| Variable | Page |
|---|---|
| `$NOTION_ARCH_PAGE_ID` | Main (Architecture) |
| `$NOTION_BUILD_PLAN_ID` | Build Plan |
| `$NOTION_BUSINESS_VALUE_ID` | Business Value & Positioning |
| `$NOTION_MULTITENANT_PLAN_ID` | Multi-Tenant SaaS Plan |
| `$NOTION_COMPETITIVE_ANALYSIS_ID` | Competitive Analysis |
| `$NOTION_PROD_SETUP_ID` | Production Setup Guide |
| `$NOTION_CLAUDE_RULES_ID` | Claude Rules & Checks |
| `$NOTION_SKILLS_PAGE_ID` | Skills & Commands |
| `$NOTION_DOCS_MAP_ID` | Docs Map (Mintlify structure) |

Setup: `cp .env.notion.example .env.notion` then fill in your workspace IDs.

Use `mcp__notion__notion-update-page` with `command: "update_content"` and targeted `old_str`/`new_str` pairs — never replace entire pages.

# Placeholder format — HARD RULE

Never use a placeholder that looks like a real secret. This includes:
- Hex strings (`abcdef1234567890abcdef1234567890`)
- Random-looking alphanumeric strings (`xK9mP2qR7nL4...`)
- Repeated patterns (`sk-xxxxxxxxxxxxxxxxxxxxxxxx`)
- Real-format fakes (`sk-test-...`, `ghp_fakefakefake`)

Always use angle-bracket descriptors instead:
```
API_KEY=<your-api-key>
SLACK_CLIENT_SECRET=<your-client-secret>
DATABASE_URL=<your-postgres-connection-string>
STRIPE_SECRET_KEY=<sk_live_... from Stripe dashboard>
```

This applies to: docs, code comments, example env files, README, test fixtures, and any commit or PR body. If a scanner can't tell it's fake, it's the wrong format.

# Secret violation protocol — HARD RULE

If Trivy's secret scanner (or Semgrep, or any other tool) detects a credential, API key, token, or secret in the codebase at any point:

1. **Stop immediately.** Do not continue the current task.
2. **Alert the user** with the exact file, line, and secret type found.
3. **Tell the user to cycle it now** — assume the credential is compromised regardless of whether it was pushed.
4. **Do not commit or push** until the secret is removed from the file AND git history.
5. **If already pushed**, tell the user to rotate the credential immediately before doing anything else, then use `git push --force-with-lease` after cleaning history.

This rule applies even if the secret looks like a placeholder or test value. Err on the side of caution — a rotated credential costs minutes; a leaked one can cost everything.
