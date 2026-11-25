import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockVolunteers, mockApplications, mockEvents, eventCalls } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockVolunteers: vi.fn(),
  mockApplications: vi.fn(),
  mockEvents: vi.fn(),
  eventCalls: [] as [string, unknown[]][],
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "volunteers") return { select: () => ({ eq: mockVolunteers }) }
      if (table === "applications") return { select: () => ({ eq: mockApplications }) }
      if (table !== "events") throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({
          eq: (...eqArgs: unknown[]) => {
            eventCalls.push(["eq", eqArgs])
            return {
              gt: (...gtArgs: unknown[]) => {
                eventCalls.push(["gt", gtArgs])
                return mockEvents()
              },
            }
          },
        }),
      }
    },
  })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import { getDashboardCounts } from "./dashboardCounts"

function eventRow(overrides: { capacity: number | null; registration_count: number | null }) {
  return overrides
}

beforeEach(() => {
  vi.clearAllMocks()
  eventCalls.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("admin")
  mockVolunteers.mockResolvedValue({ count: 0, error: null })
  mockApplications.mockResolvedValue({ count: 0, error: null })
  mockEvents.mockResolvedValue({ data: [], error: null })
})

describe("getDashboardCounts", () => {
  it("rejects signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getDashboardCounts()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
    expect(mockVolunteers).not.toHaveBeenCalled()
  })

  it.each([["volunteer"], [null]])("forbids a %s caller", async (role) => {
    mockGetUserRole.mockResolvedValue(role)
    await expect(getDashboardCounts()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(mockVolunteers).not.toHaveBeenCalled()
    expect(mockApplications).not.toHaveBeenCalled()
    expect(mockEvents).not.toHaveBeenCalled()
  })

  it("allows an admin caller", async () => {
    await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true })
  })

  it("allows a manager caller", async () => {
    mockGetUserRole.mockResolvedValue("manager")
    await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true })
  })

  it("returns zeros when there is no data", async () => {
    await expect(getDashboardCounts()).resolves.toEqual({
      ok: true,
      data: { totalVolunteers: 0, pendingApplications: 0, upcomingEvents: 0, nearFullEvents: 0 },
    })
  })

  it("counts only approved volunteers", async () => {
    mockVolunteers.mockResolvedValue({ count: 7, error: null })
    const result = await getDashboardCounts()
    expect(result).toMatchObject({ ok: true, data: { totalVolunteers: 7 } })
    expect(mockVolunteers).toHaveBeenCalledWith("status", "approved")
  })

  it("counts only pending applications", async () => {
    mockApplications.mockResolvedValue({ count: 3, error: null })
    const result = await getDashboardCounts()
    expect(result).toMatchObject({ ok: true, data: { pendingApplications: 3 } })
    expect(mockApplications).toHaveBeenCalledWith("status", "pending")
  })

  it("counts upcoming events and filters by published status and a future start", async () => {
    mockEvents.mockResolvedValue({
      data: [eventRow({ capacity: null, registration_count: null }), eventRow({ capacity: null, registration_count: null })],
      error: null,
    })
    const result = await getDashboardCounts()
    expect(result).toMatchObject({ ok: true, data: { upcomingEvents: 2 } })
    expect(eventCalls[0]).toEqual(["eq", ["status", "published"]])
    expect(eventCalls[1][0]).toBe("gt")
    expect(eventCalls[1][1][0]).toBe("starts_at")
  })

  it("filters upcoming events strictly after the current time", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"))
    try {
      await getDashboardCounts()
      expect(eventCalls[1]).toEqual(["gt", ["starts_at", "2026-01-01T12:00:00.000Z"]])
    } finally {
      vi.useRealTimers()
    }
  })

  describe("near-full events", () => {
    it("never counts an event with no capacity set", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: null, registration_count: 500 })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 0 } })
    })

    it("counts an event at the threshold (2 spots left)", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: 10, registration_count: 8 })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 1 } })
    })

    it("counts an event with 1 spot left", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: 10, registration_count: 9 })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 1 } })
    })

    it("counts an exactly full event", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: 10, registration_count: 10 })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 1 } })
    })

    it("counts an over-capacity event", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: 10, registration_count: 11 })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 1 } })
    })

    it("does not count an event with more than the threshold of spots left", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: 10, registration_count: 7 })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 0 } })
    })

    it("treats a null registration_count as zero registrations", async () => {
      mockEvents.mockResolvedValue({ data: [eventRow({ capacity: 10, registration_count: null })], error: null })
      await expect(getDashboardCounts()).resolves.toMatchObject({ ok: true, data: { nearFullEvents: 0 } })
    })
  })

  describe("org isolation", () => {
    it("never adds an explicit organization_id filter, relying on RLS", async () => {
      await getDashboardCounts()
      expect(mockVolunteers).not.toHaveBeenCalledWith("organization_id", expect.anything())
      expect(mockApplications).not.toHaveBeenCalledWith("organization_id", expect.anything())
      expect(eventCalls.find(([, args]) => args[0] === "organization_id")).toBeUndefined()
    })
  })

  describe("a failing count query is reported as an error, not folded into zero", () => {
    it("surfaces a volunteers query failure", async () => {
      mockVolunteers.mockResolvedValue({ count: null, error: { message: "volunteers down" } })
      await expect(getDashboardCounts()).resolves.toEqual({ ok: false, error: { type: "backend", message: "volunteers down" } })
    })

    it("surfaces an applications query failure", async () => {
      mockApplications.mockResolvedValue({ count: null, error: { message: "applications down" } })
      await expect(getDashboardCounts()).resolves.toEqual({ ok: false, error: { type: "backend", message: "applications down" } })
    })

    it("surfaces an events query failure", async () => {
      mockEvents.mockResolvedValue({ data: null, error: { message: "events down" } })
      await expect(getDashboardCounts()).resolves.toEqual({ ok: false, error: { type: "backend", message: "events down" } })
    })

    it("surfaces the volunteers error first when multiple queries fail", async () => {
      mockVolunteers.mockResolvedValue({ count: null, error: { message: "volunteers down" } })
      mockApplications.mockResolvedValue({ count: null, error: { message: "applications down" } })
      mockEvents.mockResolvedValue({ data: null, error: { message: "events down" } })
      await expect(getDashboardCounts()).resolves.toEqual({ ok: false, error: { type: "backend", message: "volunteers down" } })
    })
  })
})
