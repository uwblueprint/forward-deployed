import { describe, expect, it } from "vitest"

import {
  CUSTOM_FIELD_TYPES,
  customFieldCreateSchema,
  customFieldOrderSchema,
  customFieldUpdateSchema,
  organizationSettingsSchema,
} from "./settingsSchema"

describe("organizationSettingsSchema", () => {
  const valid = { name: "Food Bank", defaultRejectionMessage: "Thanks", eventCategories: ["Tutoring"], skills: [] }

  it("trims text and turns a blank message into none", () => {
    expect(
      organizationSettingsSchema.parse({ ...valid, name: " Food Bank ", defaultRejectionMessage: "  ", eventCategories: [" Tutoring "] })
    ).toEqual({ name: "Food Bank", defaultRejectionMessage: null, eventCategories: ["Tutoring"], skills: [] })
  })

  it("accepts a missing message", () => {
    expect(organizationSettingsSchema.parse({ ...valid, defaultRejectionMessage: undefined }).defaultRejectionMessage).toBeNull()
  })

  it.each([
    ["a blank name", { name: "  " }, "name"],
    ["a blank category", { eventCategories: ["Tutoring", " "] }, "eventCategories"],
    ["the same category twice, ignoring case", { eventCategories: ["Tutoring", "tutoring"] }, "eventCategories"],
    ["a skill that isn't text", { skills: [3] }, "skills"],
    ["a message over 2000 characters", { defaultRejectionMessage: "x".repeat(2001) }, "defaultRejectionMessage"],
  ])("refuses %s", (_, change, field) => {
    const result = organizationSettingsSchema.safeParse({ ...valid, ...change })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path[0]).toBe(field)
  })
})

describe("customFieldCreateSchema", () => {
  const base = { entityType: "application", fieldName: "Why?", required: false }

  it.each(CUSTOM_FIELD_TYPES.filter((type) => type !== "select" && type !== "multiselect"))(
    "accepts a %s question and drops any options",
    (fieldType) => {
      expect(customFieldCreateSchema.parse({ ...base, fieldType, options: ["Left over"] }).options).toEqual([])
    }
  )

  it.each(["select", "multiselect"])("requires options for a %s question", (fieldType) => {
    const result = customFieldCreateSchema.safeParse({ ...base, fieldType, options: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({ path: ["options"], message: "Add at least one option" })
  })

  it("keeps a select question's trimmed options", () => {
    expect(customFieldCreateSchema.parse({ ...base, fieldType: "select", options: [" S ", "M"] }).options).toEqual(["S", "M"])
  })

  it("defaults options to none", () => {
    expect(customFieldCreateSchema.parse({ ...base, fieldType: "text" }).options).toEqual([])
  })

  it.each([
    ["an unknown type", { fieldType: "file" }, "fieldType"],
    ["an unknown kind", { fieldType: "text", entityType: "event" }, "entityType"],
    ["a blank question", { fieldType: "text", fieldName: " " }, "fieldName"],
  ])("refuses %s", (_, change, field) => {
    const result = customFieldCreateSchema.safeParse({ ...base, ...change })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path[0]).toBe(field)
  })
})

describe("customFieldUpdateSchema", () => {
  it("doesn't change where a question is asked", () => {
    const parsed = customFieldUpdateSchema.parse({ fieldName: "Why?", fieldType: "text", required: true, entityType: "registration" })
    expect(parsed).not.toHaveProperty("entityType")
  })
})

describe("customFieldOrderSchema", () => {
  it("refuses an id that isn't one", () => {
    expect(customFieldOrderSchema.safeParse({ entityType: "application", ids: ["nope"] }).success).toBe(false)
  })
})
