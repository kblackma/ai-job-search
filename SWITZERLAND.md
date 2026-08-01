# Swiss Market Customization (Romandie / French-speaking Switzerland)

This fork adapts the upstream framework for job hunting in **Switzerland**, with a focus
on **Romandie** (Geneva, Lausanne, and the surrounding French-speaking cantons). The core
workflow (`/setup`, `/scrape`, `/apply`, `/interview`) is unchanged — only the portal
layer and geo defaults are customized. Nothing personal is stored in this repo: profiles,
CVs, trackers, and the company registry are all gitignored.

## Portal skills in this fork

| Skill | Source | Method | Notes |
|---|---|---|---|
| `jobup-search` | jobup.ch (JobCloud) | Public JSON API, bun CLI | The dominant Romandie job board; French + English postings |
| `job-room-search` | job-room.ch (SECO) | Public JSON API, bun CLI | Official Swiss government job platform; canton-code filters |
| `linkedin-search` | LinkedIn | Public jobs-guest endpoints, bun CLI | Upstream country-agnostic skill; pass Swiss location strings |
| `englishjobsearch-search` | englishjobsearch.ch | WebSearch/WebFetch (Cloudflare-protected, no CLI) | English-speaking / expat roles |
| `company-pages-search` | Company career pages | Greenhouse/Lever/SmartRecruiters APIs + generic fetch, bun CLI | For corporates that don't syndicate every opening to job boards |
| `freehire-search` | FreeHire | Upstream skill | Country-agnostic, kept enabled |
| `jobindex/jobnet/jobbank/jobdanmark` | Danish demos | — | **Disabled** (`enabled: false`), kept for upstream merge-friendliness |

## Geo defaults — Romandie

**LinkedIn location strings** (for `linkedin-search --location`):
- `Geneva, Switzerland`
- `Lausanne, Vaud, Switzerland`
- `Nyon, Vaud, Switzerland`
- `Vevey, Vaud, Switzerland`
- `Fribourg, Switzerland` / `Neuchâtel, Switzerland` / `Sion, Valais, Switzerland`
- `Switzerland` + `--remote remote` for CH-wide remote roles

**jobup.ch** free-text `--location` values: `Genève`, `Lausanne`, `Nyon`, `Vevey`,
`Yverdon`, `Fribourg`, `Neuchâtel`, `Sion`.

**job-room.ch canton codes** (`--canton`): `GE` Geneva, `VD` Vaud, `VS` Valais,
`NE` Neuchâtel, `FR` Fribourg, `JU` Jura (Romandie); `BE`, `ZH`, `BS` etc. for the rest
of Switzerland.

When filling `search-queries.md` during `/setup`, use these as your `[YOUR_CITY]` /
`[YOUR_REGION]` values and add French keyword variants of your role titles (e.g.
"ingénieur données" alongside "data engineer") — many jobup/job-room postings are
French-only.

## Company career pages

Many Swiss corporates (banks, pharma, watchmakers, Geneva's international organizations)
post roles **only on their own career sites**. Maintain your target list in
`company_pages.json` at the repo root (gitignored — personal). See
`.agents/skills/company-pages-search/` for the registry schema, the example file, and how
to identify a company's ATS (Greenhouse / Lever / SmartRecruiters / generic).

## Language note

Romandie postings mix French and English. The application pipeline (`/apply`) is
language-agnostic — it drafts in the posting's language. Keep both French and English CV
variants under `documents/cv/` if you apply in both.
