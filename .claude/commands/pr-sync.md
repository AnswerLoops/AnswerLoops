# PR Sync — pre-PR Notion + docs update

Run this before every `gh pr create`. Spawns a subagent that:
1. Reads Claude's rules from Notion page `38c2539abb6b81c4ac05efa2da553719`
2. Identifies what changed on the current branch (git diff vs main)
3. Determines which Notion pages and Mintlify docs need updating
4. Updates them
5. Reports back with a summary of what was updated

## Steps Claude must execute

### Step 1 — read the rules
Fetch Notion page `38c2539abb6b81c4ac05efa2da553719` (Claude Rules & Checks) with `mcp__notion__notion-fetch`.
Verify every rule in the checklist applies correctly to this PR.

### Step 2 — audit the diff
Run:
```bash
git diff main...HEAD --stat
git log main...HEAD --oneline
```
Identify the change category from AGENTS.md's mapping table:
- Any PR (minimum): Build Plan · Architecture · Production Setup Guide
- New feature: + Business Value
- New AI/LLM: + Competitive Analysis
- New env var: + Production Setup Guide (env var section)
- Architecture change: + relevant self-hosting docs page

### Step 3 — update Notion
For each required page, fetch the current content with `mcp__notion__notion-fetch`, then update with `mcp__notion__notion-update-page` using targeted `old_str`/`new_str` pairs. Never replace entire pages.

Notion page IDs:
- Architecture (main): `3762539abb6b80309582dba90926769d`
- Build Plan: `37e2539abb6b814d813ce9f5e47d7e7a`
- Business Value: `37a2539abb6b818cbcacdca523e49a29`
- Multi-Tenant SaaS Plan: `37b2539abb6b8150a561c62b73c5dc66`
- Competitive Analysis: `3822539abb6b81548dc0e35b8253a5e6`
- Production Setup Guide: `3822539abb6b8124a3dbf687e54c85ce`
- Claude Rules & Checks: `38c2539abb6b81c4ac05efa2da553719`

### Step 4 — update Mintlify docs (if architectural or feature change)
If the diff includes an architectural or feature change, identify the affected `.mdx` pages in `docs/` using the mapping table in AGENTS.md. Edit or create the relevant pages.

Then commit the docs changes:
```bash
git add docs/
git commit -m "docs: update Mintlify docs for <change summary>

<what changed and why the docs needed updating>"
```

### Step 5 — report
Output a summary table:

| Item | Status |
|---|---|
| Rules checked | ✅ / ❌ (list any violations) |
| Notion pages updated | list each page updated |
| Mintlify docs updated | list each file changed or "none needed" |
| pnpm test | ✅ / ❌ |
| pnpm build | ✅ / ❌ |
| Ready to PR | ✅ / ❌ |

If any item is ❌, fix it before the PR is created.
