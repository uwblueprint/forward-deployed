import { describe, expect, it } from "vitest"

import type { CustomField } from "./customFieldAnswers"
import { validateCustomFieldAnswers } from "./customFieldAnswers"

function field(overrides: Partial<CustomField>): CustomField {
  return {
    id: "field-1",
    organization_id: "org-1",
    entity_type: "registration",
    field_name: "Shirt size",
    field_type: "text",
    required: false,
    options: [],
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("validateCustomFieldAnswers", () => {
  it("passes through a valid answer keyed by field id", () => {
    const result = validateCustomFieldAnswers([field({ id: "f1", field_type: "text" })], { f1: "Medium" })

    expect(result).toEqual({ ok: true, data: { f1: "Medium" } })
  })

  it("drops keys that don't match a configured field", () => {
    const result = validateCustomFieldAnswers([field({ id: "f1" })], { f1: "Medium", unknown: "x" })

    expect(result).toEqual({ ok: true, data: { f1: "Medium" } })
  })

  it("errors when a required field is missing", () => {
    const result = validateCustomFieldAnswers([field({ id: "f1", required: true })], {})

    expect(result).toEqual({ ok: false, fieldErrors: { f1: ["Shirt size is required"] } })
  })

  it("passes when an optional field is missing", () => {
    const result = validateCustomFieldAnswers([field({ id: "f1", required: false })], {})

    expect(result).toEqual({ ok: true, data: {} })
  })

  it("treats a non-object answers payload as empty", () => {
    const result = validateCustomFieldAnswers([field({ id: "f1", required: true })], "nonsense")

    expect(result).toEqual({ ok: false, fieldErrors: { f1: ["Shirt size is required"] } })
  })

  it.each([
    ["number", 5, true],
    ["number", "5", false],
    ["checkbox", true, true],
    ["checkbox", "true", false],
    ["date", "2026-06-01", true],
    ["date", "not-a-date", false],
  ] as const)("validates %s field type for value %j", (fieldType, value, expected) => {
    const result = validateCustomFieldAnswers([field({ id: "f1", field_type: fieldType })], { f1: value })

    expect(result.ok).toBe(expected)
  })

  it("accepts a select value only when it's one of the configured options", () => {
    const fields = [field({ id: "f1", field_type: "select", options: ["red", "blue"] })]

    expect(validateCustomFieldAnswers(fields, { f1: "red" })).toEqual({ ok: true, data: { f1: "red" } })
    expect(validateCustomFieldAnswers(fields, { f1: "green" }).ok).toBe(false)
  })

  it("accepts a multiselect value only when every item is a configured option", () => {
    const fields = [field({ id: "f1", field_type: "multiselect", options: ["red", "blue"] })]

    expect(validateCustomFieldAnswers(fields, { f1: ["red", "blue"] })).toEqual({
      ok: true,
      data: { f1: ["red", "blue"] },
    })
    expect(validateCustomFieldAnswers(fields, { f1: ["red", "green"] }).ok).toBe(false)
  })
})
