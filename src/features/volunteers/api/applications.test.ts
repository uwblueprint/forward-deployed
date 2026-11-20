import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockVolunteerEq, mockVolunteerMaybeSingle, mockFieldsEq, mockInsert, mockSingle } = vi.hoisted(
  () => ({
    mockGetUser: vi.fn(),
    mockVolunteerEq: vi.fn(),
    mockVolunteerMaybeSingle: vi.fn(),
    mockFieldsEq: vi.fn(),
    mockInsert: vi.fn(),
    mockSingle: vi.fn(),
  })
)

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "volunteers") {
        return { select: () => ({ eq: mockVolunteerEq.mockImplementation(() => ({ maybeSingle: mockVolunteerMaybeSingle })) }) }
      }
      if (table === "custom_fields") {
        // .eq("organization_id", ...).eq("entity_type", "application") resolves to the rows.
        return { select: () => ({ eq: () => ({ eq: mockFieldsEq }) }) }
      }
      if (table === "applications") {
        return { insert: mockInsert.mockImplementation(() => ({ select: () => ({ single: mockSingle }) })) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  })),
}))

import { submitVolunteerApplication } from "./applications"

const user = { id: "user-1", email: "person@example.com" }
const question = {
  id: "q1",
  organization_id: "org-1",
  entity_type: "application" as const,
  field_name: "Why do you want to volunteer?",
  field_type: "textarea" as const,
  required: true,
  options: [],
  position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
}

function volunteerWithQuestions(questions: (typeof question)[], organizationId: string | null = "org-1") {
  mockGetUser.mockResolvedValue({ data: { user } })
  mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1", organization_id: organizationId }, error: null })
  mockFieldsEq.mockResolvedValue({ data: questions, error: null })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("submitVolunteerApplication", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(submitVolunteerApplication({})).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns no-profile when the caller has no volunteer profile yet", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(submitVolunteerApplication({})).resolves.toEqual({ ok: false, error: { type: "no-profile" } })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("inserts answers keyed by question id for the caller's own volunteer_id, dropping anything else", async () => {
    volunteerWithQuestions([question])
    mockSingle.mockResolvedValue({ data: { id: "application-1" }, error: null })

    const result = await submitVolunteerApplication({ q1: "I like helping", phone: "555-123-4567" })

    expect(result).toEqual({ ok: true, data: { id: "application-1" } })
    expect(mockVolunteerEq).toHaveBeenCalledWith("user_id", user.id)
    expect(mockInsert).toHaveBeenCalledWith({ volunteer_id: "volunteer-1", responses: { q1: "I like helping" } })
  })

  it("returns a validation error keyed by question id when a required question isn't answered", async () => {
    volunteerWithQuestions([question])

    await expect(submitVolunteerApplication({})).resolves.toEqual({
      ok: false,
      error: { type: "validation", fieldErrors: { q1: ["Why do you want to volunteer? is required"] } },
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("applies with no answers when the organization asks no questions", async () => {
    volunteerWithQuestions([])
    mockSingle.mockResolvedValue({ data: { id: "application-1" }, error: null })

    await expect(submitVolunteerApplication()).resolves.toEqual({ ok: true, data: { id: "application-1" } })
    expect(mockInsert).toHaveBeenCalledWith({ volunteer_id: "volunteer-1", responses: {} })
  })

  it("doesn't look up questions for a profile that hasn't joined an organization", async () => {
    volunteerWithQuestions([question], null)
    mockSingle.mockResolvedValue({ data: { id: "application-1" }, error: null })

    await expect(submitVolunteerApplication({})).resolves.toEqual({ ok: true, data: { id: "application-1" } })
    expect(mockFieldsEq).not.toHaveBeenCalled()
  })

  it.each([
    ["23505", "duplicate key value", { type: "duplicate" }],
    ["42501", "new row violates row-level security policy", { type: "not-eligible" }],
    ["22023", "Why do you want to volunteer? is required", { type: "validation", fieldErrors: { answers: ["Why do you want to volunteer? is required"] } }],
    ["08006", "connection failure", { type: "backend", message: "connection failure" }],
  ])("maps database error %s", async (code, message, error) => {
    volunteerWithQuestions([])
    mockSingle.mockResolvedValue({ data: null, error: { code, message } })

    await expect(submitVolunteerApplication({})).resolves.toEqual({ ok: false, error })
  })
})
