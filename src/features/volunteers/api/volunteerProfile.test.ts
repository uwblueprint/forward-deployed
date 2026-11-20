import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockGetUser,
  mockFrom,
  mockVolunteerMaybeSingle,
  mockUpdate,
  mockUpdateEq,
  mockUpdateMaybeSingle,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockVolunteerMaybeSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockUpdateMaybeSingle: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "volunteers") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: mockVolunteerMaybeSingle }) }),
          update: mockUpdate.mockImplementation(() => ({
            eq: mockUpdateEq.mockImplementation(() => ({
              select: () => ({ maybeSingle: mockUpdateMaybeSingle }),
            })),
          })),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { updateMyVolunteerProfile, updateVolunteerProfile } from "./volunteerProfile"

const user = { id: "user-1", email: "person@example.com" }
const validPayload = {
  phone: "555-123-4567",
  location: "Waterloo",
  weekdays: ["monday"],
  shiftPreference: "morning",
  skills: ["First aid"],
  emergencyContactName: "Jamie",
  emergencyContactPhone: "555-987-6543",
  emergencyContactRelationship: "Friend",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("updateVolunteerProfile", () => {
  it("returns a validation error for a malformed payload", async () => {
    const result = await updateVolunteerProfile("volunteer-1", {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe("validation")
    }
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await updateVolunteerProfile("volunteer-1", validPayload)

    expect(result).toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("updates only the editable profile columns - never status or consent_accepted_at", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockUpdateMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })

    const result = await updateVolunteerProfile("volunteer-1", validPayload)

    expect(result).toEqual({ ok: true, data: { id: "volunteer-1" } })
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "volunteer-1")
    expect(mockUpdate).toHaveBeenCalledWith({
      phone: "555-123-4567",
      location: "Waterloo",
      availability_days: ["monday"],
      shift_preference: "morning",
      skills: ["First aid"],
      emergency_contact_name: "Jamie",
      emergency_contact_phone: "555-987-6543",
      emergency_contact_relationship: "Friend",
    })
    const sentColumns = Object.keys(mockUpdate.mock.calls[0][0])
    expect(sentColumns).not.toContain("status")
    expect(sentColumns).not.toContain("consent_accepted_at")
  })

  it("returns not-found when RLS filters the row out (not self, not staff-in-org, or missing)", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await updateVolunteerProfile("someone-elses-volunteer-id", validPayload)

    expect(result).toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("returns a backend error on query failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } })

    const result = await updateVolunteerProfile("volunteer-1", validPayload)

    expect(result).toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})

describe("updateMyVolunteerProfile", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(updateMyVolunteerProfile(validPayload)).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns no-profile when the caller has no volunteer profile yet", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(updateMyVolunteerProfile(validPayload)).resolves.toEqual({
      ok: false,
      error: { type: "no-profile" },
    })
  })

  it("resolves the caller's own volunteer_id and updates just their phone, leaving status/consent alone", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockUpdateMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })

    const result = await updateMyVolunteerProfile({ ...validPayload, phone: "555-000-0000" })

    expect(result).toEqual({ ok: true, data: { id: "volunteer-1" } })
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "volunteer-1")
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "555-000-0000" })
    )
    const sentColumns = Object.keys(mockUpdate.mock.calls[0][0])
    expect(sentColumns).not.toContain("status")
    expect(sentColumns).not.toContain("consent_accepted_at")
  })
})
