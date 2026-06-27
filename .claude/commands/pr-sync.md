# PR Sync — pre-PR Notion + docs update

Run this before every `gh pr create`. Spawns a subagent that:
1. Reads Claude's rules from Notion page `38c2539abb6b81c4ac05efa2da553719`
2. Identifies what changed on the current branch (git diff vs main)
3. Determines which Notion pages and Mintlify docs need updating
4. Updates them
5. Reports back with a summary of what was updated

## Steps Claude must execute

### Step 0 — load Notion IDs
Read `.env.notion` to resolve all `$NOTION_*` variable names before making any Notion API calls:
```bash
cat .env.notion
```
Parse each `KEY=value` line. Use the resolved IDs in all subsequent Notion tool calls.

### Step 1 — read the rules
Fetch `$NOTION_CLAUDE_RULES_ID` (Claude Rules & Checks) with `mcp__notion__notion-fetch`.
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

Use IDs resolved from `.env.notion` in Step 0:
- `$NOTION_ARCH_PAGE_ID` — Architecture (main)
- `$NOTION_BUILD_PLAN_ID` — Build Plan
- `$NOTION_BUSINESS_VALUE_ID` — Business Value
- `$NOTION_MULTITENANT_PLAN_ID` — Multi-Tenant SaaS Plan
- `$NOTION_COMPETITIVE_ANALYSIS_ID` — Competitive Analysis
- `$NOTION_PROD_SETUP_ID` — Production Setup Guide
- `$NOTION_CLAUDE_RULES_ID` — Claude Rules & Checks

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
