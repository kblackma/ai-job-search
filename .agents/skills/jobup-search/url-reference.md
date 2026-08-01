# jobup.ch (JobCloud) URL Reference

Public, unauthenticated `api/v1/public` JSON endpoints used by this skill. jobup.ch is
JobCloud's Romandie brand — the dominant job board for French-speaking Switzerland
(the same JobCloud group also runs jobs.ch for German-speaking Switzerland).

> **Personal use only** — jobup.ch's `robots.txt` disallows `/api/` for every crawler
> it names, including `Googlebot`, `AdsBot-Google`, and `AdsBot-Google-Mobile` (see
> below). The endpoint itself needs no authentication, but this repo's convention is
> to respect stated crawling policy for personal-use scripts: keep volume low, don't
> use it commercially or for bulk data collection, and run it on your own responsibility.

## Search

```
GET https://www.jobup.ch/api/v1/public/search
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `query` | Free-text keyword search (title, skill, role) | `data engineer` |
| `location` | Free-text place filter — city name works directly | `Geneva`, `Genève`, `Lausanne` |
| `rows` | Page size | `20` |
| `page` | 1-indexed page number | `1` |

Returns:

```json
{
  "start": 0,
  "rows": 20,
  "num_pages": 20,
  "current_page": 1,
  "documents": [ { ... one job document per entry ... } ]
}
```

Per-document fields used by this CLI (there are more — company logos, region/category
IDs, coordinates, etc. — left unmapped):

| Field | Meaning |
|-------|---------|
| `job_id` | Job UUID — pass to `detail` |
| `title` | Job title |
| `company_name` | Employer name |
| `place` | City / locality |
| `publication_date` / `initial_publication_date` | ISO timestamps |
| `age` | Days since posting (integer) — used for client-side `--jobage` filtering |
| `slug` | URL slug (informational) |
| `tags[].type === "employment_grade"` | `{value_min, value_max}` percentage (e.g. 80–100%) |
| `language_skills` | `[{language, level}]` |
| `_links.detail_en.href` / `_links.detail_fr.href` | Public detail-page URLs |

**No documented server-side posting-age parameter was found.** A `publication-date=<n>`
query param was tried and had no observable effect on results or ordering — the CLI
filters client-side on the `age` field instead (same approach `linkedin-search` falls
back to if a portal lacks the filter server-side).

## Detail

```
GET https://www.jobup.ch/api/v1/public/search/job/<job_id>
```

`<job_id>` is the UUID from `documents[].job_id` (e.g.
`dc556809-f9df-46b4-9ec7-63ca7eccfa42`). Returns the same document shape as search
plus:

| Field | Meaning |
|-------|---------|
| `template_text` | Full job description as HTML fragment (this is what the CLI strips to plain text) |
| `template` | Full rendered posting as a standalone HTML document (includes `template_text` plus company header/footer chrome) — not used, `template_text` alone is sufficient |
| `publication_end_date` | Application deadline (ISO date) |
| `application_url` | Direct apply link (JobCloud-hosted `mycareer.jobcloud.ch` apply flow), when present |
| `external_url` | External apply link, when the employer routes off-platform instead |
| `employment_type_ids` | Numeric employment-type codes (not resolved to labels by the API; e.g. `["5"]`) |

Verified live against a real posting 2026-08-01: `template_text` contains clean
paragraph/list HTML (`<p>`, `<strong>`, `<a>`, no `<script>`), decodes and strips
cleanly to readable plain text.

## robots.txt findings

Fetched 2026-08-01. Key blocks (three near-identical `User-agent` groups: `*`,
`AdsBot-Google`, `Googlebot` — all three disallow `/api/`):

```
User-agent: *
Disallow: /api/
Disallow: /api_proxy/
Disallow: /*/login/
Disallow: /*/auth/
Disallow: /*/registrieren/  (and /fr/inscription/, /en/register/)
...
User-agent: SemrushBot
Disallow: /
```

`Sitemap:` entries point at `/sitemaps/jobup/{fr,en}/sitemap.xml` (public posting pages,
not the API).

**Implication:** the JSON API this skill uses is explicitly excluded from crawling for
every named user-agent. This skill is documented and shipped as personal-use-only
accordingly — see the warning in `SKILL.md`.

## Quirks

- **IPv6 hang under Bun's `fetch`.** `www.jobup.ch` resolves to both an AAAA and an A
  record; on this environment the IPv6 route to jobup.ch's CloudFront distribution
  hangs indefinitely (curl reproduces the same 5s+ stall with `curl -6`, while `curl -4`
  returns in ~150ms). Bun's `fetch` does not fall back fast enough. The CLI works
  around this by resolving the hostname's A record itself (`dns.resolve4`), fetching
  the IPv4 address directly, and setting the `Host` header + `tls.servername` (Bun
  fetch extension) so the original hostname is still sent for routing/vhost and TLS
  SNI/cert validation. See `cli/src/helpers.ts::resolveIPv4` / `jsonFetch`. This is the
  same class of bug as the project's documented `force_ipv4()` Python cases (Cerebras,
  Cloudflare Workers AI, Polygon, Barchart) — assume any WAF/CDN-fronted provider may
  need this.
- Responses are plain JSON — no HTML parsing needed, unlike `linkedin-search`.
- `place` is a single city/locality string (no separate canton/region field surfaced
  in the search response; `regions[].lvl_0/lvl_1` IDs exist but aren't resolved to
  names by this endpoint).
- Detail responses can be large (`template` includes a full inlined-CSS HTML document);
  the CLI only maps the fields it needs.
