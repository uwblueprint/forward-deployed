import { beforeEach, describe, expect, it, vi } from "vitest"

import { argsOf, createQueryMock } from "@/test/supabaseQueryMock"

const mockGetUser = vi.fn()
const db = createQueryMock()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, from: (table: string) => db.from(table) })),
}))

import { createCustomField, deleteCustomField, reorderCustomFields, updateCustomField } from "./customFields"

const ORG = "a1b2c3d4-0000-4000-8000-000000000001"
const Q1 = "a1b2c3d4-0000-4000-8000-0000000000a1"
const Q2 = "a1b2c3d4-0000-4000-8000-0000000000a2"
const Q3 = "a1b2c3d4-0000-4000-8000-0000000000a3"

function signedInAs(role: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  db.respond("memberships.select", { data: role ? { organization_id: ORG, role } : null, error: null })
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: Q1,
    organization_id: ORG,
    entity_type: "application",
    field_name: "T-shirt size",
    field_type: "select",
    required: true,
    options: ["S", "M"],
    position: 3,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  }
}

const shirtQuestion = {
  entityType: "application",
  fieldName: " T-shirt size ",
  fieldType: "select",
  required: true,
  options: ["S", " M "],
}

beforeEach(() => {
  vi.clearAllMocks()
  db.reset()
})

describe("createCustomField", () => {
  it("adds the question after the last one of its kind", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: { position: 2 }, error: null })
    db.respond("custom_fields.insert", { data: row(), error: null })

    const result = await createCustomField(shirtQuestion)

    expect(result).toEqual({
      ok: true,
      data: { id: Q1, fieldName: "T-shirt size", fieldType: "select", required: true, options: ["S", "M"], position: 3 },
    })
    expect(argsOf(db.find("custom_fields.insert")[0], "insert")).toEqual([
      {
        organization_id: ORG,
        entity_type: "application",
        field_name: "T-shirt size",
        field_type: "select",
        required: true,
        options: ["S", "M"],
        position: 3,
      },
    ])
    const last = db.find("custom_fields.select")[0]
    expect(last.chain).toContainEqual(["eq", ["entity_type", "application"]])
  })

  it("starts at position 0 when it's the first question", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: null, error: null })
    db.respond("custom_fields.insert", { data: row({ position: 0 }), error: null })

    await createCustomField({ ...shirtQuestion, entityType: "registration" })

    expect(argsOf(db.find("custom_fields.insert")[0], "insert")).toEqual([
      expect.objectContaining({ entity_type: "registration", position: 0 }),
    ])
  })

  it("drops options from a question type that has none", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: null, error: null })
    db.respond("custom_fields.insert", { data: row({ field_type: "text", options: [] }), error: null })

    await createCustomField({ ...shirtQuestion, fieldType: "text" })

    expect(argsOf(db.find("custom_fields.insert")[0], "insert")).toEqual([
      expect.objectContaining({ field_type: "text", options: [] }),
    ])
  })

  it("requires options for a select question", async () => {
    const result = await createCustomField({ ...shirtQuestion, options: [] })

    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { options: ["Add at least one option"] } } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("refuses a manager", async () => {
    signedInAs("manager")

    await expect(createCustomField(shirtQuestion)).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
    expect(db.find("custom_fields.insert")).toHaveLength(0)
  })

  it("maps a failed options check to the options field", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: null, error: null })
    db.respond("custom_fields.insert", {
      data: null,
      error: { code: "23514", message: 'new row for relation "custom_fields" violates check constraint "custom_fields_options_check"' },
    })

    await expect(createCustomField(shirtQuestion)).resolves.toEqual({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: { options: ["Select questions need at least one option; other types have none"] },
      },
    })
  })

  it("maps an RLS refusal to not-allowed", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: null, error: null })
    db.respond("custom_fields.insert", { data: null, error: { code: "42501", message: "new row violates row-level security policy" } })

    await expect(createCustomField(shirtQuestion)).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
  })
})

describe("updateCustomField", () => {
  const edit = { fieldName: "Shirt size", fieldType: "multiselect", required: false, options: ["S", "M", "L"] }

  it("changes the question in the caller's organization", async () => {
    signedInAs("admin")
    db.respond("custom_fields.update", {
      data: row({ field_name: "Shirt size", field_type: "multiselect", required: false, options: ["S", "M", "L"] }),
      error: null,
    })

    const result = await updateCustomField(Q1, edit)

    expect(result).toMatchObject({ ok: true, data: { fieldName: "Shirt size", fieldType: "multiselect", options: ["S", "M", "L"] } })
    const update = db.find("custom_fields.update")[0]
    expect(argsOf(update, "update")).toEqual([
      { field_name: "Shirt size", field_type: "multiselect", required: false, options: ["S", "M", "L"] },
    ])
    expect(update.chain).toContainEqual(["eq", ["id", Q1]])
    expect(update.chain).toContainEqual(["eq", ["organization_id", ORG]])
  })

  it("returns not-found for a question that isn't there", async () => {
    signedInAs("admin")
    db.respond("custom_fields.update", { data: null, error: null })

    await expect(updateCustomField(Q1, edit)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("returns not-found for a malformed id without asking the database", async () => {
    await expect(updateCustomField("nope", edit)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("refuses duplicate options", async () => {
    const result = await updateCustomField(Q1, { ...edit, options: ["S", "s"] })

    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { options: expect.any(Array) } } })
  })
})

describe("deleteCustomField", () => {
  it("removes the question", async () => {
    signedInAs("admin")
    db.respond("custom_fields.delete", { data: { id: Q1 }, error: null })

    await expect(deleteCustomField(Q1)).resolves.toEqual({ ok: true, data: { id: Q1 } })
    expect(db.find("custom_fields.delete")[0].chain).toContainEqual(["eq", ["organization_id", ORG]])
  })

  it("returns not-found when nothing was removed", async () => {
    signedInAs("admin")
    db.respond("custom_fields.delete", { data: null, error: null })

    await expect(deleteCustomField(Q1)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("refuses a manager", async () => {
    signedInAs("manager")

    await expect(deleteCustomField(Q1)).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
  })
})

describe("reorderCustomFields", () => {
  it("writes only the questions whose position changed", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", {
      data: [
        { id: Q1, position: 0 },
        { id: Q2, position: 1 },
        { id: Q3, position: 2 },
      ],
      error: null,
    })
    db.respond("custom_fields.update", { data: null, error: null }, { data: null, error: null })

    const result = await reorderCustomFields({ entityType: "application", ids: [Q2, Q1, Q3] })

    expect(result).toEqual({ ok: true, data: { ids: [Q2, Q1, Q3] } })
    const updates = db.find("custom_fields.update")
    expect(updates.map((update) => [argsOf(update, "update"), argsOf(update, "eq")])).toEqual([
      [[{ position: 0 }], ["id", Q2]],
      [[{ position: 1 }], ["id", Q1]],
    ])
  })

  it("changes nothing if the questions changed since the page loaded", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: [{ id: Q1, position: 0 }, { id: Q3, position: 1 }], error: null })

    const result = await reorderCustomFields({ entityType: "application", ids: [Q2, Q1] })

    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { ids: expect.any(Array) } } })
    expect(db.find("custom_fields.update")).toHaveLength(0)
  })

  it("reports a failed write", async () => {
    signedInAs("admin")
    db.respond("custom_fields.select", { data: [{ id: Q1, position: 0 }, { id: Q2, position: 1 }], error: null })
    db.respond(
      "custom_fields.update",
      { data: null, error: null },
      { data: null, error: { code: "XX000", message: "boom" } }
    )

    await expect(reorderCustomFields({ entityType: "application", ids: [Q2, Q1] })).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })

  it("rejects a repeated id", async () => {
    const result = await reorderCustomFields({ entityType: "application", ids: [Q1, Q1] })

    expect(result).toMatchObject({ ok: false, error: { type: "validation" } })
    expect(mockGetUser).not.toHaveBeenCalled()
  })
})
