import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockFrom, mockVolunteerEq, mockVolunteerMaybeSingle, mockInsert, mockInsertSelect, mockSingle } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockVolunteerEq: vi.fn(),
    mockVolunteerMaybeSingle: vi.fn(),
    mockInsert: vi.fn(),
    mockInsertSelect: vi.fn(),
    mockSingle: vi.fn(),
  }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "volunteers") {
        return {
          select: vi.fn(() => ({
            eq: mockVolunteerEq.mockImplementation(() => ({
              maybeSingle: mockVolunteerMaybeSingle,
            })),
          })),
        }
      }
      return {
        insert: mockInsert.mockImplementation(() => ({
          select: mockInsertSelect.mockImplementation(() => ({
            single: mockSingle,
          })),
        })),
      }
    }),
  })),
}))

import { submitVolunteerApplication } from "./applications"

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
  agreedToTerms: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("submitVolunteerApplication", () => {
  it("returns a validation error for a malformed payload", async () => {
    const result = await submitVolunteerApplication({})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe("validation")
    }
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await submitVolunteerApplication(validPayload)

    expect(result).toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns no-profile when the caller has no volunteer profile yet", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await submitVolunteerApplication(validPayload)

    expect(result).toEqual({ ok: false, error: { type: "no-profile" } })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("inserts a pending application for the caller's own volunteer_id", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockSingle.mockResolvedValue({ data: { id: "application-1" }, error: null })

    const result = await submitVolunteerApplication(validPayload)

    expect(result).toEqual({ ok: true, data: { id: "application-1" } })
    expect(mockVolunteerEq).toHaveBeenCalledWith("user_id", user.id)
    expect(mockInsert).toHaveBeenCalledWith({
      volunteer_id: "volunteer-1",
      responses: validPayload,
    })
  })

  it("returns duplicate when a pending application already exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    })

    const result = await submitVolunteerApplication(validPayload)

    expect(result).toEqual({ ok: false, error: { type: "duplicate" } })
  })

  it("returns not-eligible when the RLS check rejects the insert", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "new row violates row-level security policy" },
    })

    const result = await submitVolunteerApplication(validPayload)

    expect(result).toEqual({ ok: false, error: { type: "not-eligible" } })
  })

  it("returns a backend error for any other failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "connection failure" },
    })

    const result = await submitVolunteerApplication(validPayload)

    expect(result).toEqual({ ok: false, error: { type: "backend", message: "connection failure" } })
  })
})
