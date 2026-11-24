import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockFrom, mockVolunteer, mockApplication, mockRegistrations, mockOrganization } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockGetUserRole: vi.fn(),
    mockFrom: vi.fn(),
    mockVolunteer: vi.fn(),
    mockApplication: vi.fn(),
    mockRegistrations: vi.fn(),
    mockOrganization: vi.fn(),
  }))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockVolunteer }) }) }
      }
      if (table === "applications") {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockApplication }) }) }) }),
          }),
        }
      }
      if (table === "registrations") {
        return { select: () => ({ eq: mockRegistrations }) }
      }
      if (table === "organizations") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockOrganization }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { getVolunteerDetails } from "./volunteerDetails"

const VOLUNTEER_ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const ORG_ID = "11111111-2222-4333-8444-555555555555"

const volunteerRow = {
  id: VOLUNTEER_ID,
  user_id: "user-2",
  organization_id: ORG_ID,
  status: "approved",
  phone: "555-123-4567",
  location: "Waterloo",
  availability_days: ["monday"],
  shift_preference: "morning",
  skills: ["Cooking"],
  emergency_contact_name: "Jamie",
  emergency_contact_phone: "555-987-6543",
  emergency_contact_relationship: "Friend",
  consent_accepted_at: "2026-11-01T00:00:00Z",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  user: { id: "user-2", first_name: "Sam", last_name: "Lee", email: "sam@example.com" },
}

function event(id: string, startsAt: string, hours: number) {
  const endsAt = new Date(Date.parse(startsAt) + hours * 3_600_000).toISOString()
  return { id, title: `Event ${id}`, starts_at: startsAt, ends_at: endsAt, status: "completed" }
}

function staff(role: "admin" | "manager" = "manager") {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  mockGetUserRole.mockResolvedValue(role)
}

function found() {
  mockVolunteer.mockResolvedValue({ data: volunteerRow, error: null })
  mockApplication.mockResolvedValue({
    data: {
      id: "app-1",
      status: "rejected",
      applicant_message: "Not this season",
      submitted_at: "2026-11-02T00:00:00Z",
      reviewed_at: "2026-11-03T00:00:00Z",
    },
    error: null,
  })
  mockRegistrations.mockResolvedValue({
    data: [
      { id: "r1", status: "registered", attendance_status: "attended", event: event("e1", "2026-10-01T14:00:00.000Z", 3) },
      { id: "r2", status: "registered", attendance_status: "no_show", event: event("e2", "2026-10-15T14:00:00.000Z", 2) },
      { id: "r3", status: "registered", attendance_status: "attended", event: event("e3", "2026-09-01T14:00:00.000Z", 1.5) },
      { id: "r4", status: "cancelled", attendance_status: null, event: event("e4", "2026-12-01T14:00:00.000Z", 2) },
      { id: "r5", status: "registered", attendance_status: null, event: null },
    ],
    error: null,
  })
  mockOrganization.mockResolvedValue({ data: { settings: { skills: ["Cooking", "Driving", 3] } }, error: null })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("getVolunteerDetails", () => {
  it("never counts a cancelled signup toward hours, even if it was marked attended", async () => {
    staff()
    found()
    mockRegistrations.mockResolvedValue({
      data: [
        { id: "r1", status: "registered", attendance_status: "attended", event: event("e1", "2026-10-01T14:00:00.000Z", 3) },
        { id: "r2", status: "cancelled", attendance_status: "attended", event: event("e2", "2026-10-15T14:00:00.000Z", 2) },
      ],
      error: null,
    })

    const result = await getVolunteerDetails(VOLUNTEER_ID)

    expect(result).toMatchObject({ ok: true, data: { eventsAttended: 1, hours: 3 } })
  })

  it("returns the profile, latest application, and event history with hours", async () => {
    staff()
    found()

    const result = await getVolunteerDetails(VOLUNTEER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { user, ...volunteer } = volunteerRow
    expect(result.data.volunteer).toEqual(volunteer)
    expect(result.data.user).toEqual(user)
    expect(result.data.latestApplication).toEqual({
      id: "app-1",
      status: "rejected",
      applicantMessage: "Not this season",
      submittedAt: "2026-11-02T00:00:00Z",
      reviewedAt: "2026-11-03T00:00:00Z",
    })
    // Latest event first; a registration whose event RLS hides is left out.
    expect(result.data.events.map((item) => item.registrationId)).toEqual(["r4", "r2", "r1", "r3"])
    expect(result.data.events[2]).toEqual({
      registrationId: "r1",
      registrationStatus: "registered",
      attendance: "attended",
      event: event("e1", "2026-10-01T14:00:00.000Z", 3),
    })
    expect(result.data.eventsAttended).toBe(2)
    expect(result.data.hours).toBe(4.5)
    expect(result.data.skillOptions).toEqual(["Cooking", "Driving"])
    expect(mockRegistrations).toHaveBeenCalledWith("volunteer_id", VOLUNTEER_ID)
  })

  it("handles a volunteer with no application, signups, or organization", async () => {
    staff("admin")
    mockVolunteer.mockResolvedValue({ data: { ...volunteerRow, organization_id: null, user: null }, error: null })
    mockApplication.mockResolvedValue({ data: null, error: null })
    mockRegistrations.mockResolvedValue({ data: [], error: null })

    const result = await getVolunteerDetails(VOLUNTEER_ID)

    expect(result).toMatchObject({
      ok: true,
      data: { user: null, latestApplication: null, events: [], eventsAttended: 0, hours: 0, skillOptions: [] },
    })
    expect(mockFrom).not.toHaveBeenCalledWith("organizations")
  })

  it("returns not-found when RLS hides the volunteer", async () => {
    staff()
    mockVolunteer.mockResolvedValue({ data: null, error: null })

    await expect(getVolunteerDetails(VOLUNTEER_ID)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockFrom).not.toHaveBeenCalledWith("applications")
  })

  it("returns not-found for a malformed id without querying", async () => {
    staff()

    await expect(getVolunteerDetails("not-an-id")).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("is forbidden for volunteers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(getVolunteerDetails(VOLUNTEER_ID)).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("is forbidden when the role lookup fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockGetUserRole.mockResolvedValue(null)

    await expect(getVolunteerDetails(VOLUNTEER_ID)).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getVolunteerDetails(VOLUNTEER_ID)).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
    expect(mockGetUserRole).not.toHaveBeenCalled()
  })

  it("returns backend errors from any query", async () => {
    staff()
    found()
    mockRegistrations.mockResolvedValue({ data: null, error: { message: "boom" } })

    await expect(getVolunteerDetails(VOLUNTEER_ID)).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })

  it("returns backend errors from the volunteer query", async () => {
    staff()
    mockVolunteer.mockResolvedValue({ data: null, error: { message: "down" } })

    await expect(getVolunteerDetails(VOLUNTEER_ID)).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "down" },
    })
  })
})
