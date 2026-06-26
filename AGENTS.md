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

# Docs + Notion sync

Every time a feature ships or architecture changes, you **must** update all three:

1. **Mintlify docs repo** — update or create the relevant `.mdx` page(s) in `answerloops-docs`
2. **Notion docs map** — update the status table and any affected rows at `https://app.notion.com/p/38a2539abb6b81969e7cc3a5a9d98cfa`
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

Docs repo: `answerloops-docs` (Mintlify). Notion docs map page ID: `38a2539abb6b81969e7cc3a5a9d98cfa`

# PR creation rule — HARD REQUIREMENT

When creating a PR with `gh pr create`, you **must** do the following IN ORDER. No exceptions, no skipping:

1. Update all required Notion pages via `mcp__notion__notion-update-page` (see mapping table below)
2. Tick the `- [x] Notion updated` checklist item in the PR body before submitting
3. Only then run `gh pr create`

**Never create the PR first and update Notion later.** Notion sync happens before `gh pr create` runs. If the session ends before the PR is created, the Notion update has already been done. If the Notion update fails, fix it before creating the PR.

# Build plan hygiene

After completing any phase or significant feature, do ALL of the following before opening the PR:

1. Mark it `✅` in `BUILD-PLAN.md` and update the files list.
2. Update the "Recommended next order" section.
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

Notion page IDs:
- Main (Architecture): `3762539abb6b80309582dba90926769d`
- Build Plan: `37e2539abb6b814d813ce9f5e47d7e7a`
- Business Value & Positioning: `37a2539abb6b818cbcacdca523e49a29`
- Multi-Tenant SaaS Plan: `37b2539abb6b8150a561c62b73c5dc66`
- Competitive Analysis: `3822539abb6b81548dc0e35b8253a5e6`
- Production Setup Guide: `3822539abb6b8124a3dbf687e54c85ce`

Use `mcp__notion__notion-update-page` with `command: "update_content"` and targeted `old_str`/`new_str` pairs — never replace entire pages.
