---
name: company-pages-search
version: 1.0.0
description: >
  Registry-driven lookups of specific companies' own career pages — for
  corporates that don't syndicate all their positions to job boards (common
  among Swiss corporates, banks, pharma, and orgs around Geneva/Lausanne).
  Trigger phrases: check company career pages, openings at <company>, watch
  these companies, any new roles at <company>, monitor <company>'s careers page.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/company-pages-search/cli/src/cli.ts *)
---

# Company Pages Search Skill

Looks up job openings directly on a **registry of specific companies you care about**,
rather than a generic job board. Many corporates — especially Swiss corporates, banks,
pharma, and other orgs around Geneva/Lausanne — only post a subset of their open roles
to LinkedIn/Indeed/etc, and keep the full list on their own `careers`/`jobs` page. This
skill uses the public JSON APIs behind the three most common applicant-tracking systems
(Greenhouse, Lever, SmartRecruiters) where a company uses one, and falls back to a
best-effort HTML scrape (or a WebFetch by the agent) otherwise.

Zero runtime dependencies — it runs with just `bun`.

## ⚠️ Personal use only

This reads companies' own public career APIs and pages. Keep volume low, don't use it
commercially or for bulk data collection, and respect each site's terms of use. Run it
on your own responsibility.

## The registry

The company list lives in **`company_pages.json` at the repo root** — personal, and
gitignored (see `.gitignore`). A committed example lives at
`.agents/skills/company-pages-search/company_pages.example.json`; if `company_pages.json`
doesn't exist yet, the CLI automatically falls back to the example file and prints a
stderr warning.

**To start using this skill:** copy the example to the repo root and edit it.

```bash
cp .agents/skills/company-pages-search/company_pages.example.json company_pages.json
```

Each entry:

```json
{
  "name": "Stripe",
  "careers_url": "https://stripe.com/jobs/search",
  "ats": "greenhouse",
  "ats_id": "stripe",
  "locations_filter": ["Geneva", "Lausanne", "Remote"],
  "notes": "free text"
}
```

- `name` — display name; also the `--company` key used by `search`/`detail`.
- `careers_url` — the company's own careers/jobs page (used for `generic` scraping and
  as a human-readable link).
- `ats` — one of `greenhouse` | `lever` | `smartrecruiters` | `generic`.
- `ats_id` — the ATS's board/company token. Required for the three named ATS types;
  leave empty (`""`) for `generic`.
- `locations_filter` — optional. If non-empty, results are kept only when their
  location string contains one of these substrings (case-insensitive). Jobs with no
  parsed location are always kept (rather than silently dropped).
- `notes` — free text, e.g. how you found the ATS token, or quirks of that page.

### How to find a company's ATS

Open the company's careers page and either:
1. **Look at the URL** — many career pages are just an iframe/redirect to
   `boards.greenhouse.io/<token>`, `jobs.lever.co/<company>`, or
   `jobs.smartrecruiters.com/<Company>`. The token/company slug in that URL is your
   `ats_id`.
2. **Open browser devtools → Network tab**, click into a job listing, and look for an
   XHR request to `boards-api.greenhouse.io`, `api.lever.co`, or
   `api.smartrecruiters.com`. The path segment right after `/boards/` or `/companies/`
   or `/postings/` is the `ats_id`.
3. If neither shows up, the company likely runs a custom/in-house careers page, or an
   ATS this skill doesn't have a direct integration for (Workday, SAP SuccessFactors,
   iCIMS, etc. are common and JS-heavy). Set `ats: "generic"` and leave `ats_id: ""`.

## Commands

### List the registry

```bash
bun run .agents/skills/company-pages-search/cli/src/cli.ts list [--format json|table|plain]
```

### Search

```bash
bun run .agents/skills/company-pages-search/cli/src/cli.ts search [flags]
```

Flags:
- `--company <name>` / `-c <name>` — restrict to one registry entry (exact name match,
  case-insensitive). Omit to query every entry in the registry.
- `--query <text>` / `-q <text>` — keyword filter on job title (client-side substring).
- `--location <text>` — location filter (client-side substring, in addition to any
  registry-level `locations_filter`).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

Per-`ats` behavior:
- `greenhouse` → `GET https://boards-api.greenhouse.io/v1/boards/<ats_id>/jobs`
- `lever` → `GET https://api.lever.co/v0/postings/<ats_id>?mode=json`
- `smartrecruiters` → `GET https://api.smartrecruiters.com/v1/companies/<ats_id>/postings`
- `generic` → fetches `careers_url`, strips tags, and extracts links whose href/text
  look job-related (contains "job", "career", "vacan", "position", "opening",
  "opportunit", or "role"), emitting a best-effort "manual review" record per link with
  no parsed location/date. **This is intentionally shallow.**

### Detail

```bash
bun run .agents/skills/company-pages-search/cli/src/cli.ts detail --company <name> --id <job id> [--format json|plain]
```

`<job id>` is the ATS's own id from a `search` result's `id` field. Only works for
`greenhouse`/`lever`/`smartrecruiters` entries — `generic` entries have no detail API
(see below).

## ⚠️ `generic` entries: WebFetch is the primary path, not the CLI scrape

Many corporate/Swiss career pages are JS-rendered (React/Angular SPA) or sit behind
Cloudflare, and won't yield anything useful to a plain HTML fetch + regex link scrape.
For every registry entry with `ats: "generic"`:

1. Try `search`/`list` first — it's free and sometimes works for simple static pages.
2. If it returns nothing (or junk links), **the agent should `WebFetch` the
   `careers_url` directly** and read the rendered listings itself, or fall back to
   `WebSearch site:<company domain> careers <role>` for a JS-heavy or protected page.
   This mirrors the `job-scraper` skill's own WebSearch fallback pattern (Step 1c in
   `.claude/skills/job-scraper/SKILL.md`) — do not force the mechanical CLI scrape when
   it can't see the real content.
3. `detail` has no generic mode at all — for a `generic` entry, WebFetch the specific
   job URL you found instead.

## Orchestrator discovery (`/scrape`)

This skill follows the same portal-skill convention as `linkedin-search`, so
`.claude/skills/job-scraper/SKILL.md`'s Step 1b auto-discovers it: any orchestrator run
reads every `SKILL.md` under `.agents/skills/*/SKILL.md`, checks the `enabled` frontmatter
key (default enabled), and calls this CLI with flags translated from
`search-queries.md`. No changes to `job-scraper` are needed to pick this skill up — set
`enabled: false` above to opt a fork out without deleting the directory.

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing `id` to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the
process exits with code `1`. Per-entry fetch failures during `search` are collected into
`meta.errors` in JSON output (or a stderr `warnings` line for `table`/`plain`) rather than
aborting the whole run — one bad registry entry never blocks the others.

## Notes

- All requests set a browser-like `User-Agent`.
- The CLI retries 429/5xx with exponential backoff.
- `locations_filter` on a registry entry and `--location` on the CLI both apply (AND);
  set `locations_filter: []` to disable the registry-level filter for that company.
- See `url-reference.md` for the three ATS APIs' exact shapes and known quirks.
