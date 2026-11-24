import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, result, calls } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  result: { value: { data: [] as unknown, error: null as unknown } },
  calls: [] as [string, unknown[]][],
}))

// A thenable events query that records every call in its chain.
function eventsQuery() {
  const chain: Record<string, unknown> = {}
  for (const method of ["select", "ilike", "eq", "in", "gte", "lte", "lt", "gt", "order"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args])
      return chain
    }
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result.value).then(resolve)
  return chain
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== "events") throw new Error(`unexpected table: ${table}`)
      return eventsQuery()
    },
  })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import type { Event } from "@/lib/adapters/types"

import { deriveEventState } from "../utils/eventState"
import { getEvents, getOpportunities } from "./events"

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: "e1",
    organization_id: "org-1",
    status: "published",
    title: "Food drive",
    description: null,
    category: null,
    location: null,
    requirements: null,
    starts_at: "2026-12-05T14:00:00.000Z",
    ends_at: "2026-12-05T17:00:00.000Z",
    capacity: 10,
    registration_deadline: null,
    registration_count: 2,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  result.value = { data: [], error: null }
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

describe("getEvents", () => {
  it("returns every event in the organization, ordered by start", async () => {
    const rows = [event()]
    result.value = { data: rows, error: null }
    await expect(getEvents()).resolves.toEqual({ ok: true, data: rows })
    expect(calls).toEqual([
      ["select", ["*, registration_count"]],
      ["order", ["starts_at"]],
    ])
  })

  it("applies the shared filters plus one or several statuses", async () => {
    await getEvents({ name: "drive", category: "Food", status: "draft" })
    expect(calls).toContainEqual(["ilike", ["title", "%drive%"]])
    expect(calls).toContainEqual(["eq", ["category", "Food"]])
    expect(calls).toContainEqual(["in", ["status", ["draft"]]])

    calls.length = 0
    await getEvents({ status: ["draft", "published"] })
    expect(calls).toContainEqual(["in", ["status", ["draft", "published"]]])
  })

  it("treats an empty status list as no status filter", async () => {
    await getEvents({ status: [] })
    expect(calls.map(([method]) => method)).not.toContain("in")
  })

  it("rejects a bad status or range from the client before querying", async () => {
    const badStatus = await getEvents({ status: "archived" as never })
    expect(badStatus).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { status: expect.any(Array) } } })
    const backwards = await getEvents({ range: { from: "2026-12-02T00:00:00Z", to: "2026-12-01T00:00:00Z" } })
    expect(backwards).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { range: expect.any(Array) } } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns events overlapping a calendar window", async () => {
    await getEvents({ range: { from: "2026-12-01T05:00:00.000Z", to: "2027-01-01T05:00:00.000Z" } })
    // Starts before the window ends and ends after it begins.
    expect(calls).toContainEqual(["lt", ["starts_at", "2027-01-01T05:00:00.000Z"]])
    expect(calls).toContainEqual(["gt", ["ends_at", "2026-12-01T05:00:00.000Z"]])
  })

  it("treats search text literally, not as ilike wildcards", async () => {
    await getEvents({ name: "50%_off" })
    expect(calls).toContainEqual(["ilike", ["title", "%50\\%\\_off%"]])
  })

  it("lets managers read events", async () => {
    mockGetUserRole.mockResolvedValue("manager")
    expect((await getEvents()).ok).toBe(true)
  })

  it.each([["volunteer"], [null]])("forbids a %s caller without querying", async (role) => {
    mockGetUserRole.mockResolvedValue(role)
    await expect(getEvents()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(calls).toEqual([])
  })

  it("rejects signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getEvents()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("passes database errors through", async () => {
    result.value = { data: null, error: { message: "boom" } }
    await expect(getEvents()).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})

describe("getOpportunities (shared filters)", () => {
  it("still needs no staff role", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")
    expect((await getOpportunities({ location: "Water" })).ok).toBe(true)
    expect(calls).toContainEqual(["ilike", ["location", "%Water%"]])
    expect(mockGetUserRole).not.toHaveBeenCalled()
  })
})

describe("deriveEventState", () => {
  const start = Date.parse("2026-12-05T14:00:00.000Z")
  const end = Date.parse("2026-12-05T17:00:00.000Z")

  it("derives the phase from the clock", () => {
    expect(deriveEventState(event(), start - 1).phase).toBe("upcoming")
    expect(deriveEventState(event(), start).phase).toBe("in-progress")
    expect(deriveEventState(event(), end).phase).toBe("ended")
  })

  it("is open only when published, upcoming, before the deadline, and under capacity", () => {
    const before = start - 60_000
    expect(deriveEventState(event(), before).registration).toBe("open")
    expect(deriveEventState(event({ status: "draft" }), before).registration).toBe("unavailable")
    expect(deriveEventState(event({ status: "cancelled" }), before).registration).toBe("unavailable")
    expect(deriveEventState(event(), start).registration).toBe("closed")
    expect(deriveEventState(event({ registration_deadline: new Date(before).toISOString() }), before).registration).toBe("closed")
    expect(deriveEventState(event({ registration_count: 10 }), before).registration).toBe("full")
    expect(deriveEventState(event({ capacity: null, registration_count: 500 }), before).registration).toBe("open")
  })

  it("never reads stored status as ended: a published event past its end is just 'ended'", () => {
    expect(deriveEventState(event(), end + 1)).toEqual({ phase: "ended", registration: "closed" })
  })
})
