---
name: englishjobsearch-search
version: 1.0.0
description: >
  Use this skill when the user wants English-speaking jobs in Switzerland —
  positions that do not require German or French, expat-friendly roles, or
  postings aggregated by englishjobsearch.ch. Trigger phrases: english jobs
  switzerland, english speaking jobs geneva, english speaking jobs lausanne,
  jobs without german, jobs without french, expat jobs switzerland,
  englishjobsearch, international jobs geneva, NGO jobs geneva, english jobs
  zurich, anglophone jobs switzerland.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: WebSearch, WebFetch
---

# English Job Search (englishjobsearch.ch) Skill

[englishjobsearch.ch](https://englishjobsearch.ch) aggregates **English-speaking jobs in
Switzerland** — a key portal for roles that don't require fluent French/German, common in
international companies, NGOs, and multinationals around Geneva and Lausanne.

## ⚠️ No CLI — WebSearch/WebFetch only

The site is protected by a Cloudflare managed challenge (JavaScript required), so a
zero-dependency CLI scraper **does not work** here. This skill has **no `cli/` directory
by design.** During `/scrape` (Step 1b portal discovery), treat this portal as a
**WebSearch-driven portal**:

1. **Search** via WebSearch with `site:` queries, e.g.:
   - `site:englishjobsearch.ch "data engineer" Geneva`
   - `site:englishjobsearch.ch <role> Lausanne OR Geneva OR "Vaud"`
   - `site:englishjobsearch.ch <skill> remote Switzerland`
2. **Detail**: WebFetch the individual posting URL returned by the search. If WebFetch is
   blocked by the challenge, fall back to the Google cache/snippet content and note the
   posting URL for the user to open manually.
3. Postings here frequently syndicate from LinkedIn and company ATS pages — **dedupe**
   against results from `linkedin-search` and `company-pages-search` by company + title.

## Personal use only

Keep volume low (a handful of searches per run), never bulk-collect, and respect the
site's terms. Run on your own responsibility.

## Romandie query hints

Combine role keywords with: `Geneva`, `Geneve`, `Lausanne`, `Vaud`, `Nyon`, `Vevey`,
`Neuchatel`, `Fribourg`, `"Suisse romande"`, `"French-speaking Switzerland"`, `Remote`.
