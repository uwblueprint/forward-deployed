import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockRead, mockWrite, mockRegistrationCount, writeCalls } = vi.hoisted(() => ({
  mockRegistrationCount: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  writeCalls: [] as [string, unknown[]][],
}))

function updateChain() {
  const chain: Record<string, unknown> = {}
  for (const method of ["eq", "select"]) {
    chain[method] = (...args: unknown[]) => {
      writeCalls.push([method, args])
      return chain
    }
  }
  chain.maybeSingle = mockWrite
  return chain
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "registrations") {
        return { select: () => ({ eq: mockRegistrationCount }) }
      }
      if (table !== "events") throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({ eq: () => ({ maybeSingle: mockRead }) }),
        update: (...args: unknown[]) => {
          writeCalls.push(["update", args])
          return updateChain()
        },
      }
    },
  })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import type { Event } from "@/lib/adapters/types"

import { EVENT_TRANSITIONS, transitionBlocker } from "../utils/eventState"
import { changeEventStatus } from "./eventLifecycle"

const ID = "40000000-0000-4000-8000-0000000000a1"
const FUTURE = "2099-01-01T09:00:00.000Z"
const PAST = "2020-01-01T09:00:00.000Z"

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: ID,
    organization_id: "org-1",
    status: "draft",
    title: "Food drive",
    description: null,
    category: null,
    location: null,
    requirements: null,
    starts_at: FUTURE,
    ends_at: "2099-01-01T12:00:00.000Z",
    capacity: 10,
    registration_deadline: null,
    registration_count: 0,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  writeCalls.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

describe("transitionBlocker", () => {
  it.each([
    ["draft", "published"],
    ["draft", "cancelled"],
    ["published", "draft"],
    ["published", "cancelled"],
  ] as const)("allows %s -> %s for an upcoming event with no registrations", (from, to) => {
    expect(transitionBlocker(event({ status: from }), to)).toBeNull()
  })

  it("treats cancelled and completed as final", () => {
    for (const from of ["cancelled", "completed"] as const) {
      for (const to of Object.keys(EVENT_TRANSITIONS) as (keyof typeof EVENT_TRANSITIONS)[]) {
        if (to !== from) expect(transitionBlocker(event({ status: from }), to)).toMatch(/can't change status/)
      }
    }
  })

  it("rejects skipping straight from draft to completed", () => {
    expect(transitionBlocker(event({ starts_at: PAST }), "completed")).toMatch(/can't be moved to completed/)
  })

  it("won't publish an event that has started", () => {
    expect(transitionBlocker(event({ starts_at: PAST }), "published")).toMatch(/already started/)
  })

  it("only completes an event once it has started", () => {
    expect(transitionBlocker(event({ status: "published" }), "completed")).toMatch(/before it starts/)
    expect(transitionBlocker(event({ status: "published", starts_at: PAST }), "completed")).toBeNull()
  })

  it("won't unpublish an event people registered for", () => {
    expect(transitionBlocker(event({ status: "published", registration_count: 1 }), "draft")).toMatch(/cancel it instead/)
  })
})

describe("changeEventStatus", () => {
  it("publishes a draft, only if it is still a draft", async () => {
    mockRead.mockResolvedValue({ data: event(), error: null })
    mockWrite.mockResolvedValue({ data: event({ status: "published" }), error: null })

    const result = await changeEventStatus(ID, "published")
    expect(result).toEqual({ ok: true, data: event({ status: "published" }) })
    expect(writeCalls).toEqual([
      ["update", [{ status: "published" }]],
      ["eq", ["id", ID]],
      ["eq", ["status", "draft"]],
      ["select", ["*, registration_count"]],
    ])
  })

  it("reports a concurrent status change as a conflict", async () => {
    mockRead.mockResolvedValue({ data: event(), error: null })
    mockWrite.mockResolvedValue({ data: null, error: null })
    await expect(changeEventStatus(ID, "published")).resolves.toEqual({ ok: false, error: { type: "conflict" } })
  })

  it("returns an illegal move with its reason, without writing", async () => {
    mockRead.mockResolvedValue({ data: event({ status: "cancelled" }), error: null })
    const result = await changeEventStatus(ID, "published")
    expect(result).toEqual({
      ok: false,
      error: { type: "invalid-transition", from: "cancelled", to: "published", reason: "A cancelled event can't change status" },
    })
    expect(writeCalls).toEqual([])
  })

  it("treats moving to the current status as a no-op", async () => {
    mockRead.mockResolvedValue({ data: event(), error: null })
    await expect(changeEventStatus(ID, "draft")).resolves.toEqual({ ok: true, data: event() })
    expect(writeCalls).toEqual([])
  })

  it("reports another organization's event as not found", async () => {
    mockRead.mockResolvedValue({ data: null, error: null })
    await expect(changeEventStatus(ID, "published")).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("validates input from the client", async () => {
    const result = await changeEventStatus("nope", "archived" as never)
    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { eventId: expect.any(Array), status: expect.any(Array) } } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it.each([["volunteer"], [null]])("forbids a %s caller before reading", async (role) => {
    mockGetUserRole.mockResolvedValue(role)
    await expect(changeEventStatus(ID, "published")).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rejects signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(changeEventStatus(ID, "published")).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("unpublishes an event nobody has registered for", async () => {
    mockRead.mockResolvedValue({ data: event({ status: "published" }), error: null })
    mockRegistrationCount.mockResolvedValue({ count: 0, error: null })
    mockWrite.mockResolvedValue({ data: event(), error: null })
    expect((await changeEventStatus(ID, "draft")).ok).toBe(true)
    expect(mockRegistrationCount).toHaveBeenCalledWith("event_id", ID)
  })

  it("won't unpublish when only cancelled registrations remain", async () => {
    // registration_count is 0 (no active sign-ups), but cancelled rows still exist.
    mockRead.mockResolvedValue({ data: event({ status: "published", registration_count: 0 }), error: null })
    mockRegistrationCount.mockResolvedValue({ count: 2, error: null })
    const result = await changeEventStatus(ID, "draft")
    expect(result).toMatchObject({ ok: false, error: { type: "invalid-transition", from: "published", to: "draft" } })
    expect(writeCalls).toEqual([])
  })

  it("maps an RLS or trigger rejection to forbidden", async () => {
    mockRead.mockResolvedValue({ data: event(), error: null })
    mockWrite.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } })
    await expect(changeEventStatus(ID, "published")).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })
})
