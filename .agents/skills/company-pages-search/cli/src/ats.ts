// Per-ATS fetch + normalize functions. Each public API has its own JSON shape;
// see url-reference.md for full field docs and quirks.

import { jsonFetch, htmlFetch, scrapeGenericLinks, applyLocationsFilter, type NormalizedJob, type RegistryEntry } from "./helpers.js"

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null
  // Greenhouse/SmartRecruiters sometimes double-encode: the field value is a
  // literal string containing "&lt;h2&gt;..." rather than real "<h2>" tags, so
  // decode entities BEFORE stripping tags (decode -> strip -> decode again for
  // any entities that were themselves inside the tag-stripped text).
  const decodedOnce = decodeEntities(s)
  const stripped = decodedOnce.replace(/<[^>]+>/g, " ")
  return decodeEntities(stripped).replace(/\s+/g, " ").trim() || null
}

// ---------------------------------------------------------------------------
// Greenhouse — https://boards-api.greenhouse.io/v1/boards/<board_token>/jobs
// ---------------------------------------------------------------------------

interface GreenhouseJob {
  id: number
  title: string
  absolute_url: string
  updated_at?: string
  location?: { name?: string }
  content?: string
}

export async function fetchGreenhouse(entry: RegistryEntry, detailed = false): Promise<NormalizedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(entry.ats_id)}/jobs${detailed ? "?content=true" : ""}`
  const data = (await jsonFetch(url)) as { jobs?: GreenhouseJob[] } | null
  const jobs = data?.jobs ?? []
  const normalized = jobs.map((j) => ({
    company: entry.name,
    title: j.title,
    location: j.location?.name ?? null,
    url: j.absolute_url,
    posted: j.updated_at ?? null,
    source_ats: "greenhouse" as const,
    id: String(j.id),
  }))
  return applyLocationsFilter(normalized, entry)
}

export async function fetchGreenhouseDetail(boardId: string, jobId: string): Promise<Record<string, unknown> | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardId)}/jobs/${encodeURIComponent(jobId)}?questions=true`
  const data = (await jsonFetch(url)) as GreenhouseJob | null
  if (!data) return null
  return {
    id: String(data.id),
    title: data.title,
    location: data.location?.name ?? null,
    url: data.absolute_url,
    posted: data.updated_at ?? null,
    source_ats: "greenhouse",
    description: stripHtml(data.content),
  }
}

// ---------------------------------------------------------------------------
// Lever — https://api.lever.co/v0/postings/<company>?mode=json
// ---------------------------------------------------------------------------

interface LeverJob {
  id: string
  text: string
  hostedUrl: string
  createdAt?: number
  categories?: { location?: string; team?: string; commitment?: string }
  descriptionPlain?: string
  description?: string
}

export async function fetchLever(entry: RegistryEntry): Promise<NormalizedJob[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(entry.ats_id)}?mode=json`
  const data = (await jsonFetch(url)) as LeverJob[] | { ok: false; error: string } | null
  if (!data || !Array.isArray(data)) return []
  const normalized = data.map((j) => ({
    company: entry.name,
    title: j.text,
    location: j.categories?.location ?? null,
    url: j.hostedUrl,
    posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    source_ats: "lever" as const,
    id: j.id,
  }))
  return applyLocationsFilter(normalized, entry)
}

export async function fetchLeverDetail(company: string, jobId: string): Promise<Record<string, unknown> | null> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(jobId)}?mode=json`
  const data = (await jsonFetch(url)) as LeverJob | { ok: false } | null
  if (!data || (data as { ok?: boolean }).ok === false) return null
  const j = data as LeverJob
  return {
    id: j.id,
    title: j.text,
    location: j.categories?.location ?? null,
    url: j.hostedUrl,
    posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    source_ats: "lever",
    description: j.descriptionPlain ?? stripHtml(j.description),
  }
}

// ---------------------------------------------------------------------------
// SmartRecruiters — https://api.smartrecruiters.com/v1/companies/<id>/postings
// ---------------------------------------------------------------------------

interface SmartRecruitersJob {
  id: string
  name: string
  releasedDate?: string
  location?: { city?: string; region?: string; country?: string }
  ref?: string
}

export async function fetchSmartRecruiters(entry: RegistryEntry): Promise<NormalizedJob[]> {
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(entry.ats_id)}/postings`
  const data = (await jsonFetch(url)) as { content?: SmartRecruitersJob[] } | null
  const jobs = data?.content ?? []
  const normalized = jobs.map((j) => {
    const locParts = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean)
    return {
      company: entry.name,
      title: j.name,
      location: locParts.length ? locParts.join(", ") : null,
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(entry.ats_id)}/${j.id}`,
      posted: j.releasedDate ?? null,
      source_ats: "smartrecruiters" as const,
      id: j.id,
    }
  })
  return applyLocationsFilter(normalized, entry)
}

export async function fetchSmartRecruitersDetail(companyId: string, jobId: string): Promise<Record<string, unknown> | null> {
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyId)}/postings/${encodeURIComponent(jobId)}`
  const data = (await jsonFetch(url)) as (SmartRecruitersJob & { jobAd?: { sections?: Record<string, { title?: string; text?: string }> } }) | null
  if (!data) return null
  const locParts = [data.location?.city, data.location?.region, data.location?.country].filter(Boolean)
  const sections = data.jobAd?.sections ?? {}
  const description = Object.values(sections)
    .map((s) => stripHtml(s.text))
    .filter(Boolean)
    .join("\n\n")
  return {
    id: data.id,
    title: data.name,
    location: locParts.length ? locParts.join(", ") : null,
    url: `https://jobs.smartrecruiters.com/${encodeURIComponent(companyId)}/${data.id}`,
    posted: data.releasedDate ?? null,
    source_ats: "smartrecruiters",
    description: description || null,
  }
}

// ---------------------------------------------------------------------------
// Generic — fetch careers_url HTML, strip tags, extract job-ish links.
// ---------------------------------------------------------------------------

export async function fetchGeneric(entry: RegistryEntry): Promise<NormalizedJob[]> {
  const html = await htmlFetch(entry.careers_url)
  if (!html) return []
  const normalized = scrapeGenericLinks(html, entry.careers_url, entry.name)
  return applyLocationsFilter(normalized, entry)
}
