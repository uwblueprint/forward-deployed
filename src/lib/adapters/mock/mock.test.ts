import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MOCK_EVENTS,
  MOCK_LATENCY_MS,
  MOCK_ORGANIZATIONS,
  MOCK_VOLUNTEERS,
  MockEventRepository,
  MockVolunteerRepository,
} from "."

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Runs a mock call to completion, returning how long it took in fake time. */
async function timed<T>(call: Promise<T>): Promise<{ value: T; elapsed: number }> {
  const start = Date.now()
  let done = false
  const result = call.then((value) => {
    done = true
    return value
  })
  while (!done) await vi.advanceTimersByTimeAsync(10)
  return { value: await result, elapsed: Date.now() - start }
}

describe("mock data", () => {
  it("has two organizations, 10+ volunteers, and 5+ events", () => {
    expect(MOCK_ORGANIZATIONS).toHaveLength(2)
    expect(MOCK_VOLUNTEERS.length).toBeGreaterThanOrEqual(10)
    expect(MOCK_EVENTS.length).toBeGreaterThanOrEqual(5)
  })

  it("only points at its own organizations", () => {
    const orgIds = new Set(MOCK_ORGANIZATIONS.map((org) => org.id))
    for (const row of [...MOCK_VOLUNTEERS, ...MOCK_EVENTS]) expect(orgIds).toContain(row.organization_id)
  })

  it("has unique ids", () => {
    const ids = [...MOCK_VOLUNTEERS, ...MOCK_EVENTS].map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("MockVolunteerRepository", () => {
  it("returns typed volunteers after a simulated delay", async () => {
    const { value, elapsed } = await timed(new MockVolunteerRepository().getAll())
    expect(value).toEqual(MOCK_VOLUNTEERS)
    expect(elapsed).toBeGreaterThanOrEqual(MOCK_LATENCY_MS)
  })

  it("finds a volunteer by id, or null", async () => {
    const repo = new MockVolunteerRepository()
    expect((await timed(repo.getById(MOCK_VOLUNTEERS[0].id))).value).toEqual(MOCK_VOLUNTEERS[0])
    expect((await timed(repo.getById("missing"))).value).toBeNull()
  })

  it("creates a pending profile with a fresh consent time", async () => {
    const repo = new MockVolunteerRepository()
    const { value } = await timed(repo.create({ user_id: "user-1", phone: "519-555-0000", consent_accepted_at: "2000-01-01T00:00:00.000Z" }))
    expect(value).toMatchObject({ user_id: "user-1", phone: "519-555-0000", status: "pending" })
    expect(value.consent_accepted_at).not.toBe("2000-01-01T00:00:00.000Z")
    expect((await timed(repo.getById(value.id))).value).toEqual(value)
  })

  it("updates a profile and keeps the original consent time", async () => {
    const repo = new MockVolunteerRepository()
    const original = MOCK_VOLUNTEERS[0]
    const { value } = await timed(repo.update(original.id, { phone: "519-555-9999", consent_accepted_at: "2000-01-01T00:00:00.000Z" }))
    expect(value.phone).toBe("519-555-9999")
    expect(value.consent_accepted_at).toBe(original.consent_accepted_at)
  })

  it("rejects an update to a missing volunteer", async () => {
    const call = new MockVolunteerRepository().update("missing", { phone: "x" })
    const assertion = expect(call).rejects.toThrow("No volunteer with id missing")
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS)
    await assertion
  })

  it("hands out copies, so callers can't change the store", async () => {
    const repo = new MockVolunteerRepository()
    const { value } = await timed(repo.getAll())
    value[0].phone = "changed"
    expect((await timed(repo.getById(value[0].id))).value?.phone).toBe(MOCK_VOLUNTEERS[0].phone)
  })
})

describe("MockEventRepository", () => {
  it("returns events, including a full one, after a simulated delay", async () => {
    const { value, elapsed } = await timed(new MockEventRepository().getAll())
    expect(value).toEqual(MOCK_EVENTS)
    expect(value.some((e) => e.capacity !== null && e.registration_count === e.capacity)).toBe(true)
    expect(elapsed).toBeGreaterThanOrEqual(MOCK_LATENCY_MS)
  })

  it("creates a draft with no registrations", async () => {
    const repo = new MockEventRepository()
    const { value } = await timed(
      repo.create({ organization_id: MOCK_ORGANIZATIONS[0].id, title: "New event", starts_at: "2027-01-01T09:00:00.000Z", ends_at: "2027-01-01T11:00:00.000Z" }),
    )
    expect(value).toMatchObject({ title: "New event", status: "draft", registration_count: 0 })
  })

  it("updates an event", async () => {
    const repo = new MockEventRepository()
    const { value } = await timed(repo.update(MOCK_EVENTS[0].id, { status: "cancelled" }))
    expect(value.status).toBe("cancelled")
  })
})
