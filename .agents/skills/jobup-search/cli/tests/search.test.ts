import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResult {
  meta: { count: number; page: number }
  results: { id: string; title: string; url: string }[]
}

describe("search (live)", () => {
  test("returns real results for a data-engineer / Geneva search", async () => {
    const result = await runCLI(["search", "-q", "data engineer", "-l", "Geneva", "--limit", "5"])
    const data = parseJSON<SearchResult>(result)
    expect(data.results.length).toBeGreaterThan(0)
    const first = data.results[0]
    expect(first.id).toBeTruthy()
    expect(first.title).toBeTruthy()
    expect(first.url).toContain("jobup.ch")
  })

  test("missing query and location exits 1 with a stderr JSON error", async () => {
    const result = await runCLI(["search"])
    expect(result.exitCode).toBe(1)
    expect(() => JSON.parse(result.stderr)).not.toThrow()
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NO_CRITERIA")
  })

  test("a bogus flag value exits 1 with a stderr JSON error", async () => {
    const result = await runCLI(["search", "-q", "engineer", "--jobage", "notanumber"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_ARG")
  })
})

describe("detail (live)", () => {
  test("fetches full detail for a real job id", async () => {
    const search = await runCLI(["search", "-q", "engineer", "-l", "Geneva", "--limit", "1"])
    const data = parseJSON<SearchResult>(search)
    expect(data.results.length).toBeGreaterThan(0)
    const id = data.results[0].id

    const detail = await runCLI(["detail", id])
    const job = parseJSON<{ id: string; title: string; description: string | null }>(detail)
    expect(job.id).toBe(id)
    expect(job.title).toBeTruthy()
  })

  test("an unparsable id exits 1 with a stderr JSON error", async () => {
    const result = await runCLI(["detail", "not-a-valid-id"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_ID")
  })
})
