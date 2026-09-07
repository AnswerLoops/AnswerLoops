# SEO Page Builder — a Claude Code skill

A [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills) that builds deeply-researched SEO pages by combining **real search data** (Ahrefs / DataForSEO) with **real social data** (verbatim, source-linked quotes from Reddit, Hacker News, X, and more).

It's the methodology behind pages that rank #1 for their target keywords on [octolens.com](https://octolens.com) — generalized so it works for any site and any page type:

- `[Competitor] alternatives` roundups
- `Best [category] tools` listicles
- `[A] vs [B]` comparison pages
- Pricing guides, how-to guides, glossary pages

## The idea in one paragraph

Thin AI-generated pages don't rank, because they contain nothing a language model couldn't produce from a prompt. This skill forces two kinds of evidence into every page: **search data** (volumes, difficulty, and a live SERP read) decides what to build and how to structure it, and **primary-source data** (verbatim quotes from real users, every one linked to its source) gives the page content no competitor can copy and no LLM can hallucinate. Everything ships as a draft or PR — a human always makes the publish call.

## Install

Copy this folder into your project's skills directory:

```bash
mkdir -p .claude/skills
git clone https://github.com/octolens/seo-page-builder .claude/skills/seo-page-builder
```

Then in Claude Code, just ask for a page:

> Build a "best CI/CD tools" page

Claude will pick up the skill automatically, or invoke it explicitly with `/seo-page-builder`.

## Requirements

All data sources are optional — the skill adapts to what you have and asks instead of guessing when it has nothing:

| Purpose | Works with | Env vars |
|---|---|---|
| Keyword volumes, difficulty, SERPs | Ahrefs API v3, DataForSEO | `AHREFS_API_KEY` or `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` |
| Social / primary-source mentions | [Octolens Search API](https://octolens.com), or manual Reddit/HN mining | `OCTOLENS_API_KEY` |

## What it will never do

- Fabricate quotes, stats, or pricing — every quote is verbatim with a verified, working source link
- Reuse content across sibling pages
- Mass-generate templated pages
- Auto-publish anything

## The pipeline

1. **Scope** — page type, new vs. refresh, cannibalization check
2. **Keyword research** — volumes, difficulty, and a live SERP read that dictates format, length, and FAQ topics
3. **Primary-source mining** — 6–10 verbatim, linked user quotes; the dominant pain becomes the page's hook
4. **Fact verification** — every price and claim checked against the official source at write time
5. **Write** — SERP-matching structure, honest pros/cons, vendor disclosure, full schema (Article / ItemList / FAQPage)
6. **Site integration** — sitemap, internal links, redirects, assets, meta
7. **QA** — link checks, consistency checks, honesty pass, then handoff as a draft

## License

MIT
