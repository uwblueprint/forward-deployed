import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockGetUser,
  mockFrom,
  mockMembershipMaybeSingle,
  mockFieldsOrder,
  mockVolunteerMaybeSingle,
  mockApplicationMaybeSingle,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockMembershipMaybeSingle: vi.fn(),
  mockFieldsOrder: vi.fn(),
  mockVolunteerMaybeSingle: vi.fn(),
  mockApplicationMaybeSingle: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
      }
      if (table === "custom_fields") {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: mockFieldsOrder }) }) }) }
      }
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockVolunteerMaybeSingle }) }) }
      }
      if (table === "applications") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockApplicationMaybeSingle }) }) }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { getApplicationQuestions, getApplicationStatus, validateApplicationAnswers } from "./applicationStatus"

const user = { id: "user-1", email: "person@example.com" }
const field = {
  id: "f1",
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getApplicationQuestions", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getApplicationQuestions()).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns no-organization when the caller hasn't joined one", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getApplicationQuestions()).resolves.toEqual({
      ok: false,
      error: { type: "no-organization" },
    })
  })

  it("reads application-entity custom fields for the caller's organization", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockFieldsOrder.mockResolvedValue({ data: [field], error: null })

    await expect(getApplicationQuestions()).resolves.toEqual({ ok: true, data: [field] })
  })
})

describe("validateApplicationAnswers", () => {
  it("returns a field error for a missing required answer", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockFieldsOrder.mockResolvedValue({ data: [field], error: null })

    await expect(validateApplicationAnswers({})).resolves.toEqual({
      ok: false,
      error: { type: "validation", fieldErrors: { f1: ["Why do you want to volunteer? is required"] } },
    })
  })

  it("returns a field error for an invalid answer value", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockFieldsOrder.mockResolvedValue({
      data: [{ ...field, field_type: "number" as const, required: false }],
      error: null,
    })

    await expect(validateApplicationAnswers({ f1: "not a number" })).resolves.toEqual({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: { f1: ["Why do you want to volunteer? has an invalid value"] },
      },
    })
  })

  it("preserves valid submitted values, keyed by field id", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { organization_id: "org-1" }, error: null })
    mockFieldsOrder.mockResolvedValue({ data: [field], error: null })

    await expect(validateApplicationAnswers({ f1: "To help my community." })).resolves.toEqual({
      ok: true,
      data: { f1: "To help my community." },
    })
  })

  it("propagates no-organization from the underlying question lookup", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(validateApplicationAnswers({})).resolves.toEqual({
      ok: false,
      error: { type: "no-organization" },
    })
  })
})

describe("getApplicationStatus", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getApplicationStatus()).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns no-profile when the caller has no volunteer profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getApplicationStatus()).resolves.toEqual({
      ok: false,
      error: { type: "no-profile" },
    })
  })

  it("returns null when the caller has never applied", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockApplicationMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getApplicationStatus()).resolves.toEqual({ ok: true, data: null })
  })

  it("returns the latest application's status and configured message as-is", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockApplicationMaybeSingle.mockResolvedValue({
      data: {
        id: "application-1",
        status: "rejected",
        applicant_message: "Please reapply in the spring.",
        submitted_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    })

    await expect(getApplicationStatus()).resolves.toEqual({
      ok: true,
      data: {
        id: "application-1",
        status: "rejected",
        applicantMessage: "Please reapply in the spring.",
        submittedAt: "2026-01-01T00:00:00.000Z",
      },
    })
  })
})
