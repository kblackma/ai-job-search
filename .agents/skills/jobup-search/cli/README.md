# jobup-cli

CLI for searching jobs on **jobup.ch** (JobCloud), the dominant job board of
French-speaking Switzerland / Romandie.

**Data source**: jobup.ch public v1 JSON API (`/api/v1/public/search` and
`/api/v1/public/search/job/<id>`).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Personal use only.** jobup.ch's `robots.txt` disallows `/api/` for all crawlers
> (including `Googlebot`), so this endpoint is not intended for automated access even
> though it requires no authentication. Keep volume low, don't use it commercially or
> for bulk data collection, and run it on your own responsibility.

## Installation

```bash
cd .agents/skills/jobup-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` and/or `--location`) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Data engineer roles in Geneva
bun run src/cli.ts search -q "data engineer" -l "Geneva" --limit 5 --format table

# Accounting roles in Lausanne, posted in the last 7 days
bun run src/cli.ts search -q "comptable" -l "Lausanne" --jobage 7 --format table

# Full detail for one job
bun run src/cli.ts detail 66afa837-7d8b-4601-a49b-e5926f6804c5 --format plain
```

See `../SKILL.md` for the full flag reference and the personal-use warning.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). |
| `--location` | `-l` | Free-text place string, e.g. `"Geneva"`, `"Genève"`, `"Lausanne"`. |
| `--jobage` | | Posted within N days. No server-side param found — filtered client-side on the API's `age` field. |
| `--page` | | 1-indexed page. |
| `--rows` | | Results per page requested from the API (default 20). |
| `--limit` | `-n` | Cap results emitted (client-side, after `--rows`/`--jobage`). |
| `--format` | | `json` \| `table` \| `plain`. |

At least one of `--query`/`-q` or `--location`/`-l` is required.
