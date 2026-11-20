import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockEventMaybeSingle, mockRegistrations, calls } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockEventMaybeSingle: vi.fn(),
  mockRegistrations: vi.fn(),
  calls: [] as [string, unknown[]][],
}))

// A registrations query that records its chain and resolves when ordered.
function registrationsQuery() {
  const query: Record<string, unknown> = {}
  for (const method of ["select", "eq"]) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, args])
      return query
    }
  }
  query.order = (...args: unknown[]) => {
    calls.push(["order", args])
    return mockRegistrations()
  }
  return query
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "events") return { select: () => ({ eq: () => ({ maybeSingle: mockEventMaybeSingle }) }) }
      if (table === "registrations") return registrationsQuery()
      throw new Error(`unexpected table: ${table}`)
    },
  })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import { getEventRegistrations } from "./eventRegistrations"

const EVENT_ID = "40000000-0000-4000-8000-0000000000a1"
const rows = [
  {
    id: "r1",
    event_id: EVENT_ID,
    status: "registered",
    custom_responses: {},
    created_at: "2026-11-01T00:00:00+00:00",
    updated_at: "2026-11-01T00:00:00+00:00",
    volunteer: { id: "v1", status: "approved", user: { first_name: "Maya", last_name: "Chen", email: "maya@example.com" } },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("admin")
  mockEventMaybeSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
  mockRegistrations.mockResolvedValue({ data: rows, error: null })
})

describe("getEventRegistrations", () => {
  it("returns the event's registrations with volunteer records, oldest first", async () => {
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: true, data: rows })
    expect(calls).toEqual([
      [
        "select",
        [
          "id, event_id, status, custom_responses, created_at, updated_at, volunteer:volunteers(*, user:users(first_name, last_name, email))",
        ],
      ],
      ["eq", ["event_id", EVENT_ID]],
      ["order", ["created_at"]],
    ])
  })

  it("never asks for attendance", async () => {
    await getEventRegistrations(EVENT_ID)
    expect(String(calls[0][1][0])).not.toContain("attendance")
  })

  it("filters by status when asked", async () => {
    await getEventRegistrations(EVENT_ID, { status: "cancelled" })
    expect(calls).toContainEqual(["eq", ["status", "cancelled"]])
  })

  it("returns an empty list for an event with no registrations", async () => {
    mockRegistrations.mockResolvedValue({ data: [], error: null })
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: true, data: [] })
  })

  it("lets managers read registrations", async () => {
    mockGetUserRole.mockResolvedValue("manager")
    expect((await getEventRegistrations(EVENT_ID)).ok).toBe(true)
  })

  it("rejects signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it.each([["volunteer"], [null]])("forbids a %s caller without querying", async (role) => {
    mockGetUserRole.mockResolvedValue(role)
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(mockEventMaybeSingle).not.toHaveBeenCalled()
    expect(mockRegistrations).not.toHaveBeenCalled()
  })

  it("reports another organization's event (hidden by RLS) as not found", async () => {
    mockEventMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockRegistrations).not.toHaveBeenCalled()
  })

  it("treats a malformed id as not found without querying", async () => {
    await expect(getEventRegistrations("not-a-uuid")).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockEventMaybeSingle).not.toHaveBeenCalled()
  })

  it("rejects an unknown status filter before querying", async () => {
    const result = await getEventRegistrations(EVENT_ID, { status: "attended" as never })
    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { status: expect.any(Array) } } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("accepts a null filter from the client", async () => {
    expect((await getEventRegistrations(EVENT_ID, null as never)).ok).toBe(true)
  })

  it("accepts non-RFC ids that Postgres allows", async () => {
    const id = "40000000-0000-0000-0000-0000000000a1"
    expect((await getEventRegistrations(id)).ok).toBe(true)
  })

  it("passes database errors through as backend errors", async () => {
    mockRegistrations.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})
