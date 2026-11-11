import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockGetUser,
  mockFrom,
  mockVolunteerMaybeSingle,
  mockEventMaybeSingle,
  mockFieldsEq2,
  mockExistingMaybeSingle,
  mockInsertSingle,
  mockUpdateSingle,
  mockUpdateMaybeSingle,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockVolunteerMaybeSingle: vi.fn(),
  mockEventMaybeSingle: vi.fn(),
  mockFieldsEq2: vi.fn(),
  mockExistingMaybeSingle: vi.fn(),
  mockInsertSingle: vi.fn(),
  mockUpdateSingle: vi.fn(),
  mockUpdateMaybeSingle: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockVolunteerMaybeSingle }) }) }
      }
      if (table === "events") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockEventMaybeSingle }) }) }
      }
      if (table === "custom_fields") {
        return { select: () => ({ eq: () => ({ eq: mockFieldsEq2 }) }) }
      }
      if (table === "registrations") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockExistingMaybeSingle }) }) }),
          insert: () => ({ select: () => ({ single: mockInsertSingle }) }),
          update: () => ({
            eq: () => ({
              select: () => ({ single: mockUpdateSingle, maybeSingle: mockUpdateMaybeSingle }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { cancelRegistration, registerForEvent } from "./registrations"

const user = { id: "user-1", email: "person@example.com" }

beforeEach(() => {
  vi.clearAllMocks()
  mockFieldsEq2.mockResolvedValue({ data: [], error: null })
})

describe("registerForEvent", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns no-profile when the caller has no volunteer profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: false,
      error: { type: "no-profile" },
    })
  })

  it("returns event-not-found when the event doesn't exist or isn't visible", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: false,
      error: { type: "event-not-found" },
    })
  })

  it("returns a validation error for a missing required registration question", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockFieldsEq2.mockResolvedValue({
      data: [
        {
          id: "f1",
          organization_id: "org-1",
          entity_type: "registration",
          field_name: "Shirt size",
          field_type: "text",
          required: true,
          options: [],
          position: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    })

    const result = await registerForEvent("event-1", {})

    expect(result).toEqual({
      ok: false,
      error: { type: "validation", fieldErrors: { f1: ["Shirt size is required"] } },
    })
  })

  it("inserts a new registration for the caller's own volunteer_id when none exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockExistingMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsertSingle.mockResolvedValue({ data: { id: "registration-1" }, error: null })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: true,
      data: { id: "registration-1" },
    })
  })

  it("returns already-registered when a registered row already exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockExistingMaybeSingle.mockResolvedValue({ data: { id: "registration-1", status: "registered" }, error: null })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: false,
      error: { type: "already-registered" },
    })
  })

  it("re-registers by updating status when a cancelled row already exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockExistingMaybeSingle.mockResolvedValue({ data: { id: "registration-1", status: "cancelled" }, error: null })
    mockUpdateSingle.mockResolvedValue({ data: { id: "registration-1" }, error: null })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: true,
      data: { id: "registration-1" },
    })
    expect(mockUpdateSingle).toHaveBeenCalled()
    expect(mockInsertSingle).not.toHaveBeenCalled()
  })

  it("maps a full-capacity error to type full", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockExistingMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "This event is full" },
    })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: false,
      error: { type: "full" },
    })
  })

  it("maps an RLS rejection to not-eligible", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockEventMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockExistingMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "new row violates row-level security policy" },
    })

    await expect(registerForEvent("event-1")).resolves.toEqual({
      ok: false,
      error: { type: "not-eligible" },
    })
  })
})

describe("cancelRegistration", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(cancelRegistration("registration-1")).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("cancels the caller's own registration", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockUpdateMaybeSingle.mockResolvedValue({ data: { id: "registration-1" }, error: null })

    await expect(cancelRegistration("registration-1")).resolves.toEqual({
      ok: true,
      data: { id: "registration-1" },
    })
  })

  it("returns not-found when the row doesn't exist or isn't the caller's", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockUpdateMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(cancelRegistration("registration-1")).resolves.toEqual({
      ok: false,
      error: { type: "not-found" },
    })
  })

  it("returns not-eligible when attendance was recorded or the event is completed", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockUpdateMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "new row violates row-level security policy" },
    })

    await expect(cancelRegistration("registration-1")).resolves.toEqual({
      ok: false,
      error: { type: "not-eligible" },
    })
  })
})
