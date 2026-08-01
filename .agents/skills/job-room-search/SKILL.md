---
name: job-room-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs on job-room.ch, the
  official Swiss government (SECO) job platform / Public Employment Service — for
  jobs in Switzerland generally, or specifically in Romandie (Geneva, Vaud, Valais,
  Neuchâtel, Fribourg, Jura) or any other canton. Trigger phrases (English & French):
  job-room, jobs in Switzerland, Swiss job board, emploi Suisse, offres d'emploi
  Suisse, recherche d'emploi, ORP, RAV, service public de l'emploi, SECO jobs,
  ch.indeed-style Swiss listings, "postes vacants en Suisse romande".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/job-room-search/cli/src/cli.ts *)
---

# job-room.ch Search Skill

Search live job listings from **job-room.ch** — the official Swiss federal job
platform operated by SECO (Staatssekretariat für Wirtschaft / Secrétariat d'État à
l'économie), the Public Employment Service behind ORP/RAV offices. Public,
unauthenticated JSON API, and **zero runtime dependencies** — it runs with just `bun`.

> This mirrors the repo's `linkedin-search` skill pattern, adapted to job-room.ch's
> JSON POST-search API instead of scraped HTML.

## When to use this skill

- Search for job openings anywhere in Switzerland, by keyword and/or canton
- Filter Romandie (French-speaking Switzerland) postings by canton: **GE** Geneva,
  **VD** Vaud, **VS** Valais, **NE** Neuchâtel, **FR** Fribourg, **JU** Jura
- Filter by workload percentage (part-time vs. full-time)
- Get the full description of a specific job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/job-room-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Optional but recommended.
- `--canton <codes>` — comma-separated canton codes, e.g. `GE,VD`. Romandie codes: `GE` Geneva, `VD` Vaud, `VS` Valais, `NE` Neuchâtel, `FR` Fribourg, `JU` Jura. Omit for all of Switzerland.
- `--workload-min <n>` / `--workload-max <n>` — workload percentage bounds (0-100).
- `--page <n>` — 1-indexed page number.
- `--size <n>` / `--limit <n>` / `-n <n>` — results per page (default 20).
- `--sort <mode>` — `date_desc` (default) or `date_asc`. (`relevance` is rejected by the live API.)
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/job-room-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job-room UUID from `search` results (e.g.
`e75c4b4a-ff96-477c-908b-91fd6416fdfc`) — **not numeric** like LinkedIn job IDs. You
may also pass a URL/string containing the UUID. Returns the full description (in the
best-available language, preferring fr → de → en → it), workload, permanence, and the
original external listing URL if the posting is syndicated.

## Usage examples

```bash
# Data engineer roles in Geneva/Vaud
bun run .agents/skills/job-room-search/cli/src/cli.ts search -q "data engineer" --canton GE,VD --format table

# Full-time nursing roles across all of Romandie
bun run .agents/skills/job-room-search/cli/src/cli.ts search -q "infirmier" --canton GE,VD,VS,NE,FR,JU --workload-min 80 --format table

# Any role, all Switzerland, most recent first
bun run .agents/skills/job-room-search/cli/src/cli.ts search -q "product manager" --format table

# Full details for a specific listing
bun run .agents/skills/job-room-search/cli/src/cli.ts detail e75c4b4a-ff96-477c-908b-91fd6416fdfc --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from job-room.ch's public `jobadservice` JSON API — no credentials required.
  `robots.txt` disallows crawling the human-facing `/job-search/` UI but does not
  restrict this separate `jobadservice` API path.
- Many listings **syndicate from other Swiss job boards** (most commonly jobup.ch, or
  direct employer career pages) — see `jobContent.externalUrl` in `detail` output. The
  same role may be independently discoverable on the origin site; dedupe on
  `(title, company)` if merging job-room results with another source.
- Full field/DTO reference (all probed body fields, response paths, quirks): see
  `url-reference.md` in this skill directory.
