#!/usr/bin/env bun
// Self-contained CLI for searching jobs on jobup.ch (JobCloud), the dominant job
// board of French-speaking Switzerland / Romandie. No external CLI framework, so
// it runs anywhere `bun` is available with zero install beyond the repo clone.
//
// Personal use only. jobup.ch's robots.txt disallows /api/ for all crawlers, so
// automated access is against the site's stated crawling policy even though the
// endpoint itself requires no authentication. Keep volume low and do not use it
// commercially or for bulk data collection. Run it on your own responsibility.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `jobup-cli — search jobs on jobup.ch (JobCloud, Romandie / French-speaking Switzerland)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (job title, skill, or role).
  --location, -l <text>   Place string, e.g. "Geneva", "Genève", "Lausanne", "Nyon".
  --jobage <days>         Posted within N days. No server-side param found — filtered
                          client-side on the API's \`age\` field. Default: all.
  --page <n>              1-indexed page. Default 1.
  --rows <n>              Results per page requested from the API. Default 20.
  --limit, -n <n>         Cap results emitted (client-side, after --rows/--jobage).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "data engineer" -l "Geneva" --limit 5 --format table
  bun run src/cli.ts search -q "comptable" -l "Lausanne" --jobage 7 --format table
  bun run src/cli.ts search -q "ingénieur logiciel" -l "Fribourg" --format plain
  bun run src/cli.ts detail 66afa837-7d8b-4601-a49b-e5926f6804c5 --format plain

Personal use only — jobup.ch's robots.txt disallows /api/ for crawlers; keep volume low.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const query = typeof flags.query === "string" ? flags.query : undefined
    const location = typeof flags.location === "string" ? flags.location : undefined
    if (!query && !location) {
      process.stderr.write(
        JSON.stringify({
          error: "at least one of --query/-q or --location/-l is required",
          code: "NO_CRITERIA",
        }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
        return null
      }
      return val
    }

    for (const name of ["jobage", "page", "rows", "limit"]) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    const opts: SearchOpts = {
      query,
      location,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      rows: flags.rows ? Math.max(1, parseInt(flags.rows as string, 10)) : 20,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
