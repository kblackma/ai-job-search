// Registry-driven lookups against companies' own career pages, for corporates
// that don't syndicate all positions to job boards. Three ATS types have public,
// unauthenticated JSON APIs (Greenhouse, Lever, SmartRecruiters); everything else
// ("generic") gets a best-effort HTML scrape here, with a documented fallback to
// WebFetch/WebSearch for JS-heavy or Cloudflare-protected sites (see SKILL.md).

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export type AtsType = "greenhouse" | "lever" | "smartrecruiters" | "generic"

export interface RegistryEntry {
  name: string
  careers_url: string
  ats: AtsType
  ats_id: string
  locations_filter?: string[]
  notes?: string
}

export interface NormalizedJob {
  company: string
  title: string
  location: string | null
  url: string
  posted: string | null
  source_ats: AtsType
  id?: string
}

// Repo root = three levels up from cli/src/ (cli/src -> cli -> company-pages-search
// -> skills -> .agents -> repo root is one more up). Resolved relative to this file
// so it works regardless of the caller's cwd.
// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/Users/..."
// and path.resolve then produces "C:\\C:\\Users\\...", so every command ENOENTs.
const SKILL_DIR = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const REPO_ROOT = path.resolve(SKILL_DIR, "../../..")
const REGISTRY_PATH = path.join(REPO_ROOT, "company_pages.json")
const EXAMPLE_REGISTRY_PATH = path.join(SKILL_DIR, "company_pages.example.json")

/**
 * Load the personal registry (company_pages.json at repo root). Falls back to
 * the committed example registry with a stderr warning if the personal file
 * doesn't exist yet.
 */
export async function loadRegistry(): Promise<RegistryEntry[]> {
  let file = REGISTRY_PATH
  if (!existsSync(file)) {
    process.stderr.write(
      JSON.stringify({
        warning: `No personal registry at ${REGISTRY_PATH}; falling back to the example registry. Copy company_pages.example.json to company_pages.json at the repo root and edit it.`,
        code: "USING_EXAMPLE_REGISTRY",
      }) + "\n",
    )
    file = EXAMPLE_REGISTRY_PATH
  }
  const raw = await readFile(file, "utf-8")
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`Registry at ${file} must be a JSON array`)
  return parsed as RegistryEntry[]
}

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on 404. */
export async function jsonFetch(url: string): Promise<unknown | null> {
  const maxRetries = 4
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 400)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 6000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

/** Fetch HTML with the same backoff policy, for generic-ATS scraping. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 4
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 400)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 6000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
}

/** Absolutize a possibly-relative href against the page's base URL. */
function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

const JOB_KEYWORDS = [
  "job", "jobs", "career", "careers", "vacan", "position", "opening", "opportunit", "role",
]

/**
 * Best-effort scrape for ats=generic: extract <a href> links whose href or link
 * text looks job-related. This is intentionally shallow — many corporate career
 * pages are JS-rendered or behind Cloudflare, in which case this returns few or
 * no records and the agent should fall back to WebFetch on careers_url directly
 * (documented in SKILL.md).
 */
export function scrapeGenericLinks(html: string, baseUrl: string, company: string): NormalizedJob[] {
  const results: NormalizedJob[] = []
  const seen = new Set<string>()
  const linkRe = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const rawHref = decodeHtmlEntities(m[1])
    const text = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    const hay = (rawHref + " " + text).toLowerCase()
    if (!JOB_KEYWORDS.some((k) => hay.includes(k))) continue
    if (!text) continue
    const url = absolutize(rawHref, baseUrl)
    if (!url) continue
    if (seen.has(url)) continue
    seen.add(url)
    results.push({
      company,
      title: text.length > 140 ? text.slice(0, 140) + "…" : text,
      location: null,
      url,
      posted: null,
      source_ats: "generic",
    })
  }
  return results
}

export function matchesFilters(job: NormalizedJob, query?: string, location?: string): boolean {
  if (query) {
    const q = query.toLowerCase()
    if (!job.title.toLowerCase().includes(q)) return false
  }
  if (location) {
    const l = location.toLowerCase()
    if (!(job.location || "").toLowerCase().includes(l)) return false
  }
  return true
}

export function applyLocationsFilter(jobs: NormalizedJob[], entry: RegistryEntry): NormalizedJob[] {
  const filters = entry.locations_filter
  if (!filters || filters.length === 0) return jobs
  const lowered = filters.map((f) => f.toLowerCase())
  return jobs.filter((j) => {
    if (!j.location) return true // keep unknown-location records rather than silently dropping them
    const loc = j.location.toLowerCase()
    return lowered.some((f) => loc.includes(f))
  })
}
