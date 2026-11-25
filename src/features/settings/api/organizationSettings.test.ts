import { beforeEach, describe, expect, it, vi } from "vitest"

import { argsOf, createQueryMock } from "@/test/supabaseQueryMock"

const mockGetUser = vi.fn()
const db = createQueryMock()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, from: (table: string) => db.from(table) })),
}))

import { getSettings, updateOrganizationSettings } from "./organizationSettings"

const ORG = "a1b2c3d4-0000-4000-8000-000000000001"

function signedInAs(role: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  db.respond("memberships.select", { data: role ? { organization_id: ORG, role } : null, error: null })
}

function field(overrides: Record<string, unknown>) {
  return {
    id: "q",
    organization_id: ORG,
    entity_type: "application",
    field_name: "Why?",
    field_type: "text",
    required: false,
    options: [],
    position: 0,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  }
}

const validInput = {
  name: "  Waterloo Food Bank ",
  defaultRejectionMessage: "Thanks for applying.",
  eventCategories: ["Food security", " Tutoring "],
  skills: ["Driving"],
}

beforeEach(() => {
  vi.clearAllMocks()
  db.reset()
})

describe("getSettings", () => {
  it("returns the organization's settings and questions split by kind, in order", async () => {
    signedInAs("admin")
    db.respond("organizations.select", {
      data: {
        name: "Waterloo Food Bank",
        default_rejection_message: null,
        settings: { event_categories: ["Food security"], skills: ["Driving", 3], theme: "dark" },
      },
      error: null,
    })
    db.respond("custom_fields.select", {
      data: [
        field({ id: "a1", position: 0 }),
        field({ id: "r1", entity_type: "registration", field_type: "select", options: ["S", "M"], position: 0 }),
        field({ id: "a2", position: 1, required: true, field_type: "checkbox" }),
      ],
      error: null,
    })

    const result = await getSettings()

    expect(result).toEqual({
      ok: true,
      data: {
        organization: {
          name: "Waterloo Food Bank",
          defaultRejectionMessage: null,
          eventCategories: ["Food security"],
          skills: ["Driving"],
        },
        applicationQuestions: [
          { id: "a1", fieldName: "Why?", fieldType: "text", required: false, options: [], position: 0 },
          { id: "a2", fieldName: "Why?", fieldType: "checkbox", required: true, options: [], position: 1 },
        ],
        registrationQuestions: [
          { id: "r1", fieldName: "Why?", fieldType: "select", required: false, options: ["S", "M"], position: 0 },
        ],
      },
    })
    expect(argsOf(db.find("custom_fields.select")[0], "eq")).toEqual(["organization_id", ORG])
  })

  it("treats missing lists as empty", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: { name: "Org", default_rejection_message: null, settings: {} }, error: null })
    db.respond("custom_fields.select", { data: [], error: null })

    const result = await getSettings()

    expect(result).toMatchObject({ ok: true, data: { organization: { eventCategories: [], skills: [] } } })
  })

  it.each([["manager"], ["volunteer"], [null]])("refuses a %s", async (role) => {
    signedInAs(role)

    await expect(getSettings()).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
    expect(db.find("organizations.select")).toHaveLength(0)
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getSettings()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("reports a failed read as a backend error", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: null, error: { code: "XX000", message: "boom" } })
    db.respond("custom_fields.select", { data: [], error: null })

    await expect(getSettings()).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})

describe("updateOrganizationSettings", () => {
  it("saves trimmed values and keeps other settings keys", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: { settings: { theme: "dark", skills: ["Old"] } }, error: null })
    db.respond("organizations.update", { data: { id: ORG }, error: null })

    const result = await updateOrganizationSettings(validInput)

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Waterloo Food Bank",
        defaultRejectionMessage: "Thanks for applying.",
        eventCategories: ["Food security", "Tutoring"],
        skills: ["Driving"],
      },
    })
    const update = db.find("organizations.update")[0]
    expect(argsOf(update, "update")).toEqual([
      {
        name: "Waterloo Food Bank",
        default_rejection_message: "Thanks for applying.",
        settings: { theme: "dark", event_categories: ["Food security", "Tutoring"], skills: ["Driving"] },
      },
    ])
    expect(argsOf(update, "eq")).toEqual(["id", ORG])
  })

  it("stores a blank rejection message as none", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: { settings: {} }, error: null })
    db.respond("organizations.update", { data: { id: ORG }, error: null })

    await updateOrganizationSettings({ ...validInput, defaultRejectionMessage: "   " })

    expect(argsOf(db.find("organizations.update")[0], "update")).toEqual([
      expect.objectContaining({ default_rejection_message: null }),
    ])
  })

  it("rejects bad input before touching the database", async () => {
    const result = await updateOrganizationSettings({
      name: " ",
      defaultRejectionMessage: "x".repeat(2001),
      eventCategories: ["Tutoring", "tutoring"],
      skills: [""],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: {
          name: expect.any(Array),
          defaultRejectionMessage: expect.any(Array),
          eventCategories: expect.any(Array),
          skills: expect.any(Array),
        },
      },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("refuses a manager", async () => {
    signedInAs("manager")

    await expect(updateOrganizationSettings(validInput)).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
    expect(db.find("organizations.update")).toHaveLength(0)
  })

  it("maps a failed settings check to a validation error", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: { settings: {} }, error: null })
    db.respond("organizations.update", {
      data: null,
      error: { code: "23514", message: 'new row for relation "organizations" violates check constraint "organizations_settings_lists"' },
    })

    await expect(updateOrganizationSettings(validInput)).resolves.toEqual({
      ok: false,
      error: { type: "validation", fieldErrors: { form: ["Categories and skills must be lists of text"] } },
    })
  })

  it("maps a permission refusal to not-allowed", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: { settings: {} }, error: null })
    db.respond("organizations.update", { data: null, error: { code: "42501", message: "permission denied" } })

    await expect(updateOrganizationSettings(validInput)).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
  })

  it("returns not-found when nothing was updated", async () => {
    signedInAs("admin")
    db.respond("organizations.select", { data: { settings: {} }, error: null })
    db.respond("organizations.update", { data: null, error: null })

    await expect(updateOrganizationSettings(validInput)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })
})
