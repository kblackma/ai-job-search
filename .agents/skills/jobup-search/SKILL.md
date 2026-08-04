---
name: jobup-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs on jobup.ch or in
  French-speaking Switzerland / Romandie — Geneva, Lausanne, Nyon, Vevey, Fribourg,
  Neuchâtel, Sion, Yverdon, or the Suisse romande region generally. jobup.ch (JobCloud)
  is the dominant job board for that market. Trigger phrases in English: jobs in
  Geneva, jobs in Lausanne, job search Switzerland, Swiss job openings, jobup,
  vacancies in Romandie. Trigger phrases in French: emploi Genève, emploi Lausanne,
  offres d'emploi Suisse romande, recherche d'emploi Genève, postes vacants, travail
  en Suisse, offres d'emploi jobup, chercher un emploi.
context: fork
enabled: false  # OFF BY DEFAULT: this CLI uses jobup.ch's /api/ path, which their robots.txt disallows for *. Enabling it is your explicit decision - read the robots.txt findings in url-reference.md first
allowed-tools: Bash(bun run .agents/skills/jobup-search/cli/src/cli.ts *)
---

# jobup.ch Search Skill

Search live job listings from jobup.ch's public JSON API — JobCloud's job board for
**French-speaking Switzerland / Romandie** (Geneva, Vaud, Fribourg, Valais, Neuchâtel,
Jura). No authentication, no API key, and **zero runtime dependencies** — it runs with
just `bun`.

## ⚠️ Personal use only

jobup.ch's `robots.txt` disallows `/api/` for every named crawler (`*`, `Googlebot`,
`AdsBot-Google`). The API needs no authentication, but this is a clear crawling-policy
signal, so treat this the same as `linkedin-search`: **keep volume low, don't use it
commercially or for bulk data collection, and run it on your own responsibility.** See
`url-reference.md` for the full robots.txt findings.

## When to use this skill

- Search for job openings in Geneva, Lausanne, or anywhere in Romandie
- Search by keyword in English or French (`data engineer`, `comptable`, `ingénieur`)
- Filter by recency (posted within N days, filtered client-side — see Notes)
- Get the full description, employment grade, and application deadline for a specific listing

## Commands

### Search job listings

```bash
bun run .agents/skills/jobup-search/cli/src/cli.ts search [flags]
```

At least one of `--query`/`-q` or `--location`/`-l` is required.

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Works in French or English.
- `--location <text>` / `-l <text>` — free-text place, e.g. `"Geneva"`, `"Genève"`, `"Lausanne"`, `"Nyon"`.
- `--jobage <days>` — posted within N days. **No server-side parameter exists for this**
  (tested a `publication-date` param with no effect); the CLI filters client-side on
  the API's `age` field, so it applies after `--rows` is fetched.
- `--page <n>` — page number (1-indexed).
- `--rows <n>` — results requested per page from the API (default `20`).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side, applied after `--jobage`).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/jobup-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job UUID from `search` results (e.g. `dc556809-f9df-46b4-9ec7-63ca7eccfa42`).
You may also pass a full jobup.ch detail URL — the UUID is extracted from it. Returns the
full description, employment type/grade, and application deadline (`publication_end_date`).

## Romandie location strings (tested live)

All of the following worked as `--location` values against the live API on 2026-08-01:

| City | `--location` value |
|------|---------------------|
| Geneva | `"Geneva"` or `"Genève"` |
| Lausanne | `"Lausanne"` |
| Nyon | `"Nyon"` |
| Vevey | `"Vevey"` |
| Fribourg | `"Fribourg"` |
| Neuchâtel | `"Neuchâtel"` |
| Sion | `"Sion"` |
| Yverdon | `"Yverdon"` (matches Yverdon-les-Bains postings) |

## Usage examples

```bash
# Data engineer roles in Geneva
bun run .agents/skills/jobup-search/cli/src/cli.ts search -q "data engineer" -l "Geneva" --format table

# Accounting roles in Lausanne, posted in the last 7 days
bun run .agents/skills/jobup-search/cli/src/cli.ts search -q "comptable" -l "Lausanne" --jobage 7 --format table

# Software engineer roles in French, in Fribourg
bun run .agents/skills/jobup-search/cli/src/cli.ts search -q "ingénieur logiciel" -l "Fribourg" --format table

# Any role, Nyon only
bun run .agents/skills/jobup-search/cli/src/cli.ts search -l "Nyon" --format plain

# Full details for a specific job
bun run .agents/skills/jobup-search/cli/src/cli.ts detail dc556809-f9df-46b4-9ec7-63ca7eccfa42 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from jobup.ch's public `api/v1/public` JSON endpoints — no credentials required,
  no HTML parsing needed (unlike `linkedin-search`).
- `--jobage` is enforced **client-side** on the API's `age` field (days since posting) —
  there is no known server-side posting-age parameter. If you need results older than
  what a single page's `age` values cover, raise `--rows` or paginate with `--page`.
- Job IDs are UUIDs (e.g. `dc556809-f9df-46b4-9ec7-63ca7eccfa42`), not numeric — pass
  them as-is, or as part of a full detail URL, to `detail`.
- **IPv6 hang workaround**: jobup.ch's IPv6 route hangs under Bun's `fetch` in this
  environment; the CLI resolves and connects over IPv4 directly (see `url-reference.md`
  Quirks). If a future jobup.ch infra change breaks this, the workaround is isolated to
  `cli/src/helpers.ts::jsonFetch`.
- No rate-limit behavior was observed during testing, but the CLI still retries
  429/5xx with exponential backoff — keep volume low regardless (see ToS note above).