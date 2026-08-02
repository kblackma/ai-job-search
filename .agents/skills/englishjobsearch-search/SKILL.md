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

## ⚠️ No CLI — WebSearch only

The site is protected by a Cloudflare **managed JS challenge**. Verified: `curl` with a
full browser user-agent and header set still returns **HTTP 403 + "Just a moment"**, so
this is *not* the user-agent 403 that browser headers fix. There is no header trick, and
`WebFetch` on an individual posting hits the same wall. This skill has **no `cli/`
directory by design**, and `/scrape` routes it to the Step 1c WebSearch path.

**Do not report this portal as broken or degraded** in the Step 4.75 health check — no CLI
is the intended state.

## Search by canton — this is the key to getting results

The site is organised **by canton**, and generic `site:` queries mostly return landing
pages rather than postings. Target the canton taxonomy directly. Confirmed live URL
patterns:

```
https://englishjobsearch.ch/in/<canton-slug>/<topic-slug>    e.g. /in/canton-geneve/cyber_security
https://englishjobsearch.ch/in/<canton-slug>                 e.g. /in/canton-vaud
https://englishjobsearch.ch/jobs/<topic-slug>                e.g. /jobs/cyber_security   (Switzerland-wide)
https://englishjobsearch.ch/in/<city-slug>                   e.g. /in/geneve
```

The canton index is linked from the site's home page. **Romandie canton slugs:**
`canton-geneve`, `canton-vaud`, `canton-valais`, `canton-neuchatel`, `canton-fribourg`,
`canton-jura`. City-level slugs also exist: `geneve`, `lausanne`.

**Topic slugs** are lowercase with underscores. Confirmed to exist: `cyber_security`,
`computer`, `devops`, `project_manager`, `backend_developer`, `frontend_developer`, `qa`,
`specialist`. An unknown slug simply returns nothing, costing one search.

### Query patterns

Run these as WebSearch queries. Including the canton path is what makes the site surface
individual postings rather than its own landing pages:

```
site:englishjobsearch.ch/in/<canton-slug> <topic-slug>
site:englishjobsearch.ch/in/<canton-slug> <role keywords>
site:englishjobsearch.ch/jobs/<topic-slug> <role keywords>      # Switzerland-wide sweep
```

### Detail fetches and honesty limits

Because both the challenge and `WebFetch` block posting pages, rely on the search result
title and snippet, record the posting URL for the user to open manually, and **never
fabricate posting content that was not in the snippet**. If a posting looks strong and the
snippet is thin, report it as "detail unavailable, open manually" rather than guessing.

In practice WebSearch surfaces this site's category pages more readily than individual
postings, so yield through search alone is modest. A browser-automation route (driving a
real browser session that can pass the challenge) is the reliable way to read the canton
pages if one is available.

Postings here frequently syndicate from LinkedIn and company ATS pages — **dedupe** against
`linkedin-search` and `company-pages-search` results by company + title.

## Personal use only

Keep volume low (a handful of searches per run), never bulk-collect, and respect the
site's terms. Run on your own responsibility.

## Romandie query hints

Combine role keywords with: `Geneva`, `Geneve`, `Lausanne`, `Vaud`, `Nyon`, `Vevey`,
`Neuchatel`, `Fribourg`, `"Suisse romande"`, `"French-speaking Switzerland"`, `Remote`.
