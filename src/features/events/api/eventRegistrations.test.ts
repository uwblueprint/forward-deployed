import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockEventMaybeSingle, mockRegistrations, mockUpdate, updateCalls, calls } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  updateCalls: [] as [string, unknown[]][],
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
  query.update = (...args: unknown[]) => {
    updateCalls.push(["update", args])
    const chain: Record<string, unknown> = {}
    for (const method of ["eq", "select"]) {
      chain[method] = (...a: unknown[]) => {
        updateCalls.push([method, a])
        return chain
      }
    }
    chain.maybeSingle = mockUpdate
    return chain
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

import { getEventRegistrations, setAttendance } from "./eventRegistrations"

const EVENT_ID = "40000000-0000-4000-8000-0000000000a1"
const rows = [
  {
    id: "r1",
    event_id: EVENT_ID,
    status: "registered",
    attendance_status: null,
    custom_responses: {},
    created_at: "2026-11-01T00:00:00+00:00",
    updated_at: "2026-11-01T00:00:00+00:00",
    volunteer: { id: "v1", status: "approved", user: { first_name: "Maya", last_name: "Chen", email: "maya@example.com" } },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  updateCalls.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("admin")
  mockEventMaybeSingle.mockResolvedValue({ data: { id: EVENT_ID }, error: null })
  mockRegistrations.mockResolvedValue({ data: rows, error: null })
})

describe("getEventRegistrations", () => {
  it("returns the event's registrations with volunteer records and attendance, oldest first", async () => {
    await expect(getEventRegistrations(EVENT_ID)).resolves.toEqual({ ok: true, data: rows })
    expect(calls).toEqual([
      [
        "select",
        [
          "id, event_id, status, attendance_status, custom_responses, created_at, updated_at, volunteer:volunteers(*, user:users(first_name, last_name, email))",
        ],
      ],
      ["eq", ["event_id", EVENT_ID]],
      ["order", ["created_at"]],
    ])
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

describe("setAttendance", () => {
  const REGISTRATION_ID = "50000000-0000-4000-8000-0000000000a1"

  it("marks a registration attended and returns it", async () => {
    const updated = { ...rows[0], attendance_status: "attended" }
    mockUpdate.mockResolvedValue({ data: updated, error: null })
    await expect(setAttendance(REGISTRATION_ID, "attended")).resolves.toEqual({ ok: true, data: updated })
    expect(updateCalls.slice(0, 2)).toEqual([
      ["update", [{ attendance_status: "attended" }]],
      ["eq", ["id", REGISTRATION_ID]],
    ])
  })

  it("lets managers correct attendance to no-show", async () => {
    mockGetUserRole.mockResolvedValue("manager")
    mockUpdate.mockResolvedValue({ data: { ...rows[0], attendance_status: "no_show" }, error: null })
    expect((await setAttendance(REGISTRATION_ID, "no_show")).ok).toBe(true)
  })

  it.each([["volunteer"], [null]])("forbids a %s caller without writing", async (role) => {
    mockGetUserRole.mockResolvedValue(role)
    await expect(setAttendance(REGISTRATION_ID, "attended")).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(updateCalls).toEqual([])
  })

  it("rejects signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(setAttendance(REGISTRATION_ID, "attended")).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("never sends null or an unknown value, and rejects a malformed id", async () => {
    for (const value of [null, "late"]) {
      const result = await setAttendance(REGISTRATION_ID, value as never)
      expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { attendance: expect.any(Array) } } })
    }
    const badId = await setAttendance("nope", "attended")
    expect(badId).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { registrationId: expect.any(Array) } } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("reports another organization's registration (hidden by RLS) as not found", async () => {
    mockUpdate.mockResolvedValue({ data: null, error: null })
    await expect(setAttendance(REGISTRATION_ID, "attended")).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("maps a database rejection to forbidden and other errors to backend", async () => {
    mockUpdate.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } })
    await expect(setAttendance(REGISTRATION_ID, "attended")).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    mockUpdate.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } })
    await expect(setAttendance(REGISTRATION_ID, "attended")).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})
