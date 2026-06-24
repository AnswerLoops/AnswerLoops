<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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

# Build plan hygiene

After completing any phase or significant feature, do ALL of the following before opening the PR:

1. Mark it `✅` in `docs/BUILD-PLAN.md` and update the files list.
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
