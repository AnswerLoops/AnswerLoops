---
name: seo-page-builder
description: "Build deeply-researched SEO pages that actually rank, by combining real search data (Ahrefs / DataForSEO) with primary-source social data (real user quotes from Reddit, Hacker News, X, etc.). Use when the user asks to build, draft, or refresh any SEO-targeted page: alternatives/competitor roundups, 'best X tools' listicles, comparison pages, pricing guides, how-to guides, or glossary pages. Covers the full pipeline: keyword research → SERP analysis → primary-source mining → fact verification → writing → site integration → QA."
---

# SEO Page Builder

Build SEO pages backed by **evidence, not vibes**: real search data decides *what* to build and *how to structure it*; real primary-source data (verbatim, linked quotes from actual users) makes the page **impossible to copy** and worth ranking.

## Why this methodology

Learned the hard way, and verifiable in any SERP:

- **Thin AI pages don't rank.** Short (~800-word), salesy, single-product pages that a language model could generate from a prompt contain nothing Google needs to surface. If your page is reconstructable from training data, there's no reason to rank it.
- **Research-heavy pages do.** What ranks for commercial keywords is almost always deep, structured content: roundups with 7–12 real options, comparison tables, verified pricing, honest pros/cons, FAQs answering real questions — thousands of words that required actual work.
- **Primary-source content is the moat.** Verbatim, source-linked quotes from real users (complaints, recommendations, experiences) are content no competitor can copy and no LLM can hallucinate. They also supply the exact language searchers use.
- **One deep page beats five thin ones.** Never batch-generate templated pages. Every page gets the full pipeline.

## Prerequisites

Configure what's available; the skill degrades gracefully.

| Data need | Options (any one works) | Typical env var |
|---|---|---|
| Keyword volumes, difficulty, CPC | Ahrefs API v3, DataForSEO, Semrush | `AHREFS_API_KEY`, `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` |
| Live SERP snapshots | DataForSEO SERP API, Ahrefs SERP overview, or manual incognito search | same as above |
| Social / primary-source data | Octolens Search API (all platforms, one call), or manual search on Reddit / Hacker News / X / G2 / community forums | `OCTOLENS_API_KEY` |
| Fact verification | WebFetch / WebSearch on official pricing + docs pages | — |

If no SEO API is configured, ask the user for volumes/SERP screenshots rather than guessing numbers. If no social data source is configured, mine manually (site:reddit.com searches, HN Algolia search) — slower, same rules.

## Hard rules (non-negotiable)

1. **Unique content only.** Fresh copy for every section of every page. Never reuse quotes, FAQ answers, or product blurbs across sibling pages — duplicated blocks across pages are a defect.
2. **Real quotes only.** Every quote must be verbatim from a real, public post, with a working link. Use `…` for truncation and `[brackets]` for substitutions. Never fabricate, never paraphrase-as-quote, never invent stats. Verify every URL resolves before shipping.
3. **Verify every fact at write time.** Pricing, feature availability, plan limits — fetch the official source *the day you write*. Stale pricing is the single most common recurring defect on comparison content. Use one figure consistently across the page.
4. **Honesty ranks.** Credit competitors' genuine strengths ("Best for…"). Include candid weaknesses of the site owner's own product. If the site owner is a vendor in the category, disclose it on the page. Honest pages earn rankings, AI-search citations, and reader trust.
5. **Draft for review, never auto-publish.** Deliver on a feature branch / as a PR / as a draft file. A human makes the publish call.
6. **No mass generation.** This skill builds one page per run, fully researched. Refuse "generate 50 pages" requests; propose a prioritized build order instead.

## Workflow

### Phase 0 — Scope the page

1. Establish: **target topic**, **page type**, and whether a page already exists (refresh vs. new). On refreshes keep the URL and original publish date; update the modified date.
2. Pick the page type — this shapes every later phase:

| Page type | Primary intent | Primary-source data to mine (Phase 2) |
|---|---|---|
| `[Competitor] alternatives` roundup | Switching / evaluation | Complaints about the competitor (pricing, complexity, gaps) |
| `Best [category] tools` listicle | Evaluation | Recommendations, "what do you use for X" threads, praise & complaints per tool |
| `[A] vs [B]` comparison | Decision | Head-to-head experiences, migration stories |
| Pricing guide (`[Product] pricing`) | Research | Real invoice/contract anecdotes, "is it worth it" threads |
| How-to / guide | Informational | Questions people actually ask, failed-approach stories |
| Glossary / definition | Informational | How practitioners actually use the term |

3. Read any existing brand/positioning docs in the repo (voice, ICP, product facts) so copy claims stay accurate.

### Phase 1 — Keyword research (real numbers, always)

1. **Build the keyword set** around the topic. For a commercial page include the modifier family: `[topic]`, `best [topic]`, `[topic] tools/software`, `[topic] free`, `[competitor] alternatives`, `[A] vs [B]`, `[topic] pricing`, `[topic] api`, plus question forms.
2. **Pull volume, difficulty, CPC** for the whole set:
   - Ahrefs v3: `GET /keywords-explorer/overview` (or `/site-explorer/organic-keywords` for pages that already rank)
   - DataForSEO: `POST /v3/keywords_data/google_ads/search_volume/live` + `POST /v3/dataforseo_labs/google/bulk_keyword_difficulty/live`
3. **Check the site's current rankings** for the set (Ahrefs `site-explorer/organic-keywords` with `mode=exact|prefix`, or DataForSEO `ranked_keywords/live`) — you may be refreshing a striking-distance page instead of building new.
4. **Pull the live SERP** for the primary keyword (DataForSEO `serp/google/organic/live/advanced`, depth 20) and read it like an editor:
   - **Format:** what page type ranks (roundup, guide, product page)? Match it — don't fight the SERP.
   - **Length norms:** how many items do ranking lists include? Match the range.
   - **AI Overview present?** Include a clean, citable definition/answer block near the top.
   - **People Also Ask:** record the questions — they become the FAQ section (with schema).
   - **Who ranks:** note weaknesses you can beat (stale dates, no pricing, no primary sources).
5. **Cannibalization check:** if the site has a nearby page, compare the two SERPs. Under ~30% URL overlap → safe to build both; add guards (don't target the sibling's keyword in title/H1; cross-link the pages). Over that → refresh the existing page instead.
6. **Decide and record:** target keyword, secondary keywords, page format, list length, title (include the year for evaluation keywords).
7. **Save the research report** (e.g. `data/keywords/YYYY-MM-DD-<topic>-research.md`): Keyword | Volume | KD | CPC | Intent table, SERP notes, decision, API cost footer.

### Phase 2 — Primary-source mining (the moat)

Collect 6–10 verbatim, linkable quotes matched to the page type (see Phase 0 table). Real people describing real problems in their own words — this is the content competitors can't copy.

1. **With a social listening API** (e.g. Octolens Search API — `POST https://app.octolens.com/api/v2/search`, Bearer auth, body `{"query": "...", "timeWindow": "30d", "maxResults": 20, "sources": ["reddit", "hackernews", "twitter"]}`): run several phrasings — the topic itself, `[topic] pricing`, `alternative to [x]`, `switching from [x]`, `how do you [task]`. Complaint- and recommendation-rich sources: Reddit, Hacker News, X.
2. **Without an API:** Google `site:reddit.com "[topic]"`, HN Algolia search, G2/Capterra review pages, relevant Discourse/Slack-community archives. Same standards apply.
3. **Select quotes** that: name specific pain (price figures, missing features, wasted time), use searcher language, and where possible mention multiple products at once. Dedupe by author/URL.
4. **Verify every URL** is live and public. Drop anything that doesn't resolve.
5. **Find the hook:** the dominant pattern across quotes (e.g. "API is paywalled", "pricing requires a sales call", "alerts are 90% noise") becomes the page's opening angle — in the users' own words.
6. **Save the shortlist** (quote, author/handle, platform, URL, theme) alongside the keyword report.

### Phase 3 — Fact verification

1. For every product/claim that will appear on the page: WebFetch the **current official pricing page** and docs. Record entry price, what's gated behind which tier, API access cost, recent changes. For enterprise tools with hidden pricing, use contract-data sources (e.g. Vendr) and label figures as median/reported.
2. Every item in a roundup needs: current pricing, one genuine strength ("Best for…"), 2–3 pros, 2–3 cons, one key differentiator.
3. If research surfaces durable new facts (price change, acquisition), update the repo's competitor/positioning docs and tell the user.

### Phase 4 — Write the page

Structure follows the SERP-winning format from Phase 1; substance comes from Phases 2–3.

- **Hero/intro:** open with the Phase 2 hook, in searcher language. For evaluation keywords, include a citable 2–3 sentence direct answer (AI Overview bait) above the fold.
- **Primary-source block:** embed the quote wall early — real cards, each linking out, with the subject term highlighted. This is the differentiator; don't bury it.
- **Body by page type:**
  - *Roundup/alternatives:* comparison table up top; per-tool deep-dives with verified pricing, pros/cons, "Best for". If the site owner's product is in the list it can lead, but with honest cons and a vendor disclosure line.
  - *Vs page:* dimension-by-dimension table, then "choose A if / choose B if".
  - *Guide/how-to:* steps with real examples; failed approaches from Phase 2 as "common mistakes".
- **Decision framework:** "If you need X → choose Y" scenarios that recommend competitors where they honestly win.
- **FAQ:** answer the actual PAA questions from Phase 1 (plus pricing/migration questions), not invented ones.
- **Schema (JSON-LD):** `Article` (with real author + dates) always; `ItemList` for roundups; `FAQPage` matching the rendered FAQs exactly; `HowTo` for guides. Never mark up content that isn't on the page; only include ratings if defensible.
- **E-E-A-T:** author byline, methodology note ("how we evaluated"), last-updated date that matches the schema.

### Phase 5 — Site integration

Generic checklist — adapt to the site's stack:

- [ ] Add to sitemap.
- [ ] Add internal links: hub/category page, footer or nav where relevant, contextual links from 2–3 related pages (and from the new page back out).
- [ ] Redirect any legacy/singular/old-slug variants to the new URL.
- [ ] Generate required assets (hero image, screenshots). Never ship a broken hero. Skip screenshots that would capture bot-walls or cookie modals — an imageless card beats a "verify you're human" screenshot.
- [ ] Canonical tag, meta title (~55–60 chars, keyword-leading), meta description (~150 chars, includes the hook).

### Phase 6 — QA before handoff

- [ ] Build/lint passes (if it's a code site).
- [ ] Every quote URL opens a real public post; quotes verbatim.
- [ ] All facts/prices verified this session; one figure used consistently; flag contradictions on sibling pages.
- [ ] Schema validates and matches rendered content; dates correct (keep original publish date on refreshes).
- [ ] Honesty pass: genuine competitor strengths present, own-product cons present, vendor disclosure present (if applicable).
- [ ] No copy-paste artifacts: no sibling-page product names, no template leftovers, no duplicated paragraphs (grep a few distinctive sentences across the site).
- [ ] Deliverable is a draft/PR, not a publish.
- Report to the user: what was built, target keyword + volume, format decision and why, quotes used, anything stale discovered elsewhere on the site.

## Refresh mode

For existing pages: rerun Phases 1–3 (rankings may have shifted, prices certainly have), keep the URL and original publish date, replace stale quotes with fresh ones, update `dateModified`, and diff old vs. new to confirm the page got *more* specific, not just longer.
