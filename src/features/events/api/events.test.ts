import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockFrom, mockEventsQuery, mockVolunteerMaybeSingle, mockRegistrationsEq, mockEventsIn } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockEventsQuery: { resolved: { data: [] as unknown, error: null as unknown } },
    mockVolunteerMaybeSingle: vi.fn(),
    mockRegistrationsEq: vi.fn(),
    mockEventsIn: vi.fn(),
  }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "events") {
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thenable query-builder mock
          select: (): any => {
            const chain: Record<string, (...args: unknown[]) => unknown> = {}
            const methods = ["ilike", "eq", "gte", "lte", "order"]
            for (const method of methods) {
              chain[method] = vi.fn(() => chain)
            }
            chain.in = mockEventsIn.mockImplementation(() => chain)
            ;(chain as { then?: unknown }).then = (
              resolve: (value: { data: unknown; error: unknown }) => unknown
            ) => Promise.resolve(mockEventsQuery.resolved).then(resolve)
            return chain
          },
        }
      }
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockVolunteerMaybeSingle }) }) }
      }
      if (table === "registrations") {
        return { select: () => ({ eq: mockRegistrationsEq }) }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { getMyEvents, getOpportunities } from "./events"

const user = { id: "user-1", email: "person@example.com" }

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    organization_id: "org-1",
    status: "published",
    title: "Food drive",
    description: null,
    category: "food",
    location: "Waterloo",
    requirements: null,
    starts_at: "2099-01-01T09:00:00.000Z",
    ends_at: "2099-01-01T12:00:00.000Z",
    capacity: 10,
    registration_deadline: null,
    registration_count: 2,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEventsQuery.resolved = { data: [], error: null }
})

describe("getOpportunities", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getOpportunities()).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns events as-is when no filters are given", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    const events = [event()]
    mockEventsQuery.resolved = { data: events, error: null }

    await expect(getOpportunities()).resolves.toEqual({ ok: true, data: events })
  })

  it("returns a backend error on query failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockEventsQuery.resolved = { data: null, error: { message: "boom" } }

    await expect(getOpportunities()).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })

  describe("onlyAvailable", () => {
    it("keeps a published, open, under-capacity event", async () => {
      mockGetUser.mockResolvedValue({ data: { user } })
      const available = event()
      mockEventsQuery.resolved = { data: [available], error: null }

      await expect(getOpportunities({ onlyAvailable: true })).resolves.toEqual({
        ok: true,
        data: [available],
      })
    })

    it("drops a full event", async () => {
      mockGetUser.mockResolvedValue({ data: { user } })
      mockEventsQuery.resolved = {
        data: [event({ capacity: 2, registration_count: 2 })],
        error: null,
      }

      await expect(getOpportunities({ onlyAvailable: true })).resolves.toEqual({ ok: true, data: [] })
    })

    it("drops an event past its registration deadline", async () => {
      mockGetUser.mockResolvedValue({ data: { user } })
      mockEventsQuery.resolved = {
        data: [event({ registration_deadline: "2020-01-01T00:00:00.000Z" })],
        error: null,
      }

      await expect(getOpportunities({ onlyAvailable: true })).resolves.toEqual({ ok: true, data: [] })
    })

    it("drops an event that already started", async () => {
      mockGetUser.mockResolvedValue({ data: { user } })
      mockEventsQuery.resolved = {
        data: [event({ starts_at: "2020-01-01T00:00:00.000Z" })],
        error: null,
      }

      await expect(getOpportunities({ onlyAvailable: true })).resolves.toEqual({ ok: true, data: [] })
    })

    it("drops a non-published event", async () => {
      mockGetUser.mockResolvedValue({ data: { user } })
      mockEventsQuery.resolved = { data: [event({ status: "draft" })], error: null }

      await expect(getOpportunities({ onlyAvailable: true })).resolves.toEqual({ ok: true, data: [] })
    })
  })
})

describe("getMyEvents", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getMyEvents()).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns no-profile when the caller has no volunteer profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getMyEvents()).resolves.toEqual({
      ok: false,
      error: { type: "no-profile" },
    })
  })

  it("returns empty buckets when the caller has no registrations", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockRegistrationsEq.mockResolvedValue({ data: [], error: null })

    await expect(getMyEvents()).resolves.toEqual({
      ok: true,
      data: { upcoming: [], completed: [], cancelled: [] },
    })
  })

  it("buckets a cancelled registration as cancelled even though the event is still published", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockRegistrationsEq.mockResolvedValue({
      data: [{ status: "cancelled", event_id: "event-1" }],
      error: null,
    })
    mockEventsQuery.resolved = { data: [event({ status: "published" })], error: null }

    const result = await getMyEvents()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.cancelled).toHaveLength(1)
      expect(result.data.upcoming).toHaveLength(0)
    }
  })

  it("buckets a registered volunteer's event as cancelled when the event itself was cancelled", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockRegistrationsEq.mockResolvedValue({
      data: [{ status: "registered", event_id: "event-1" }],
      error: null,
    })
    mockEventsQuery.resolved = { data: [event({ status: "cancelled" })], error: null }

    const result = await getMyEvents()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.cancelled).toHaveLength(1)
    }
  })

  it("buckets a completed event as completed", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockRegistrationsEq.mockResolvedValue({
      data: [{ status: "registered", event_id: "event-1" }],
      error: null,
    })
    mockEventsQuery.resolved = { data: [event({ status: "completed" })], error: null }

    const result = await getMyEvents()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.completed).toHaveLength(1)
    }
  })

  it("buckets a registered, published event as upcoming", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockRegistrationsEq.mockResolvedValue({
      data: [{ status: "registered", event_id: "event-1" }],
      error: null,
    })
    mockEventsQuery.resolved = { data: [event({ status: "published" })], error: null }

    const result = await getMyEvents()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.upcoming).toHaveLength(1)
    }
  })
})
