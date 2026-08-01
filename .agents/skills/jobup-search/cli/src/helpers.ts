// Data source: jobup.ch (JobCloud) public v1 JSON API. No authentication required.
// Both search and detail return clean JSON, so no HTML parsing is needed — just a
// thin mapper from the API's document shape to the portal-skill contract shape.

export const SEARCH_URL = "https://www.jobup.ch/api/v1/public/search"
export const DETAIL_URL = "https://www.jobup.ch/api/v1/public/search/job"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// jobup.ch's AAAA record hangs on this environment's IPv6 route (dual-stack
// happy-eyeballs never falls back fast enough under Bun's fetch). We resolve
// the hostname's IPv4 address ourselves and connect to it directly, sending
// the original Host header and TLS SNI so cert validation still works. See
// the "Outbound HTTP" note in the project CLAUDE.md — same class of bug as
// the documented Python force_ipv4() cases (Cerebras/Cloudflare/etc).
async function resolveIPv4(hostname: string): Promise<string> {
  const dns = await import("node:dns/promises")
  const addrs = await dns.resolve4(hostname)
  if (!addrs.length) throw new Error(`No IPv4 address found for ${hostname}`)
  return addrs[0]
}

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch<T = unknown>(url: string): Promise<T | null> {
  const parsed = new URL(url)
  const hostname = parsed.hostname
  const ip = await resolveIPv4(hostname)
  const ipUrl = new URL(url)
  ipUrl.hostname = ip

  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(ipUrl.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,*/*;q=0.8",
        "Accept-Language": "fr-CH,fr;q=0.9,en;q=0.8",
        Host: hostname,
      },
      // @ts-expect-error Bun-specific fetch extension: force SNI to the real hostname
      // even though we're connecting to a bare IP.
      tls: { servername: hostname },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  age: number | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  employmentGrade: string | null
  applicationDeadline: string | null
  applyUrl: string | null
}

interface RawDocument {
  job_id: string
  title: string
  company_name?: string | null
  place?: string | null
  publication_date?: string | null
  initial_publication_date?: string | null
  age?: number | null
  slug?: string
  tags?: { type: string; value_min?: number; value_max?: number }[]
  employment_type_ids?: string[]
  _links?: {
    detail_en?: { href: string }
    detail_fr?: { href: string }
  }
}

interface RawDetail extends RawDocument {
  template_text?: string | null
  publication_end_date?: string | null
  application_url?: string | null
  external_url?: string | null
}

function detailUrlFromLinks(doc: RawDocument): string {
  return (
    doc._links?.detail_en?.href ??
    doc._links?.detail_fr?.href ??
    `https://www.jobup.ch/en/jobs/detail/${doc.job_id}/`
  )
}

function employmentGradeFromTags(tags: RawDocument["tags"]): string | null {
  const grade = tags?.find((t) => t.type === "employment_grade")
  if (!grade) return null
  if (grade.value_min === grade.value_max) return `${grade.value_min}%`
  return `${grade.value_min}-${grade.value_max}%`
}

export function mapCard(doc: RawDocument): JobCard {
  return {
    id: doc.job_id,
    title: doc.title,
    company: doc.company_name ?? null,
    location: doc.place ?? null,
    date: doc.initial_publication_date ?? doc.publication_date ?? null,
    url: detailUrlFromLinks(doc),
    age: typeof doc.age === "number" ? doc.age : null,
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function cleanDescription(html: string | null | undefined): string | null {
  if (!html) return null
  const cleaned = decodeHtmlEntities(stripTags(html))
  return cleaned || null
}

export function mapDetail(doc: RawDetail): JobDetail {
  return {
    ...mapCard(doc),
    description: cleanDescription(doc.template_text),
    employmentType: doc.employment_type_ids?.length ? doc.employment_type_ids.join(", ") : null,
    employmentGrade: employmentGradeFromTags(doc.tags),
    applicationDeadline: doc.publication_end_date ?? null,
    applyUrl: doc.application_url || doc.external_url || null,
  }
}

/** jobup.ch has no documented server-side posting-age filter; filter client-side on `age` (days). */
export function withinJobAge(card: JobCard, days: number): boolean {
  if (!days || days <= 0 || days >= 9999) return true
  return card.age !== null && card.age <= days
}
