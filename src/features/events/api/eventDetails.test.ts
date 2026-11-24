import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockGetUser,
  mockEventMaybeSingle,
  mockEventEq,
  mockFieldsOrder,
  mockFieldsEq,
  mockVolunteerMaybeSingle,
  mockRegistrationMaybeSingle,
  mockRegistrationEq,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockEventMaybeSingle: vi.fn(),
  mockEventEq: vi.fn(),
  mockFieldsOrder: vi.fn(),
  mockFieldsEq: vi.fn(),
  mockVolunteerMaybeSingle: vi.fn(),
  mockRegistrationMaybeSingle: vi.fn(),
  mockRegistrationEq: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: mockEventEq.mockImplementation(() => ({ maybeSingle: mockEventMaybeSingle })),
          }),
        }
      }
      if (table === "custom_fields") {
        return {
          select: () => ({
            eq: mockFieldsEq.mockImplementation(() => ({
              eq: mockFieldsEq.mockImplementation(() => ({ order: mockFieldsOrder })),
            })),
          }),
        }
      }
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockVolunteerMaybeSingle }) }) }
      }
      if (table === "registrations") {
        return {
          select: () => ({
            eq: mockRegistrationEq.mockImplementation(() => ({
              eq: mockRegistrationEq.mockImplementation(() => ({ maybeSingle: mockRegistrationMaybeSingle })),
            })),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  })),
}))

import { getEventDetails, getMyVolunteerStatus } from "./eventDetails"

const EVENT_ID = "6f1c2c1e-2a4b-4c55-9a1d-1f0e8b7c6d5a"
const user = { id: "user-1", email: "person@example.com" }
const event = {
  id: EVENT_ID,
  organization_id: "org-1",
  status: "published",
  title: "Food drive",
  capacity: 10,
  registration_count: 2,
}
const question = {
  id: "f1",
  organization_id: "org-1",
  entity_type: "registration" as const,
  field_name: "Shirt size",
  field_type: "text" as const,
  required: true,
  options: [],
  position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user } })
  mockEventMaybeSingle.mockResolvedValue({ data: event, error: null })
  mockFieldsOrder.mockResolvedValue({ data: [question], error: null })
  mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1", status: "approved" }, error: null })
  mockRegistrationMaybeSingle.mockResolvedValue({ data: null, error: null })
})

describe("getEventDetails", () => {
  it("returns not-found for a malformed id without querying", async () => {
    await expect(getEventDetails("not-a-uuid")).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getEventDetails(EVENT_ID)).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns not-found when RLS hides the event", async () => {
    mockEventMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getEventDetails(EVENT_ID)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("returns a backend error when the event query fails", async () => {
    mockEventMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } })

    await expect(getEventDetails(EVENT_ID)).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })

  it("returns the event, the organization's registration questions, and the caller's status", async () => {
    const result = await getEventDetails(EVENT_ID)

    expect(result).toEqual({
      ok: true,
      data: { event, questions: [question], registration: null, volunteerStatus: "approved" },
    })
    expect(mockEventEq).toHaveBeenCalledWith("id", EVENT_ID)
    expect(mockFieldsEq).toHaveBeenCalledWith("organization_id", "org-1")
    expect(mockFieldsEq).toHaveBeenCalledWith("entity_type", "registration")
    expect(mockFieldsOrder).toHaveBeenCalledWith("position")
  })

  it("includes the caller's own registration for this event", async () => {
    mockRegistrationMaybeSingle.mockResolvedValue({ data: { id: "reg-1", status: "registered" }, error: null })

    const result = await getEventDetails(EVENT_ID)

    expect(result.ok && result.data.registration).toEqual({ id: "reg-1", status: "registered" })
    expect(mockRegistrationEq).toHaveBeenCalledWith("event_id", EVENT_ID)
    expect(mockRegistrationEq).toHaveBeenCalledWith("volunteer_id", "volunteer-1")
  })

  it("reports a pending volunteer's status", async () => {
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1", status: "pending" }, error: null })

    const result = await getEventDetails(EVENT_ID)

    expect(result.ok && result.data.volunteerStatus).toBe("pending")
  })

  it("skips the registration lookup with no volunteer profile", async () => {
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getEventDetails(EVENT_ID)

    expect(result.ok && result.data).toMatchObject({ registration: null, volunteerStatus: null })
    expect(mockRegistrationMaybeSingle).not.toHaveBeenCalled()
  })

  it("returns a backend error when the questions query fails", async () => {
    mockFieldsOrder.mockResolvedValue({ data: null, error: { message: "fields down" } })

    await expect(getEventDetails(EVENT_ID)).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "fields down" },
    })
  })
})

describe("getMyVolunteerStatus", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getMyVolunteerStatus()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns the caller's volunteer status", async () => {
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1", status: "pending" }, error: null })

    await expect(getMyVolunteerStatus()).resolves.toEqual({ ok: true, data: "pending" })
  })

  it("returns null with no volunteer profile", async () => {
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getMyVolunteerStatus()).resolves.toEqual({ ok: true, data: null })
  })
})
