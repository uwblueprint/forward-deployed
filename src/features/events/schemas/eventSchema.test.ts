import { describe, expect, it } from "vitest"
import { z } from "zod"

import { eventSchema, eventUpdateSchema } from "./eventSchema"

const valid = {
  title: "Saturday sorting shift",
  starts_at: "2026-12-05T14:00:00.000Z",
  ends_at: "2026-12-05T17:00:00.000Z",
}

function fieldErrors(input: unknown) {
  const result = eventSchema.safeParse(input)
  return result.success ? {} : z.flattenError(result.error).fieldErrors
}

describe("eventSchema", () => {
  it("accepts the required fields and nulls the optional ones", () => {
    expect(eventSchema.parse(valid)).toEqual({
      ...valid,
      description: null,
      category: null,
      location: null,
      requirements: null,
      capacity: null,
      registration_deadline: null,
    })
  })

  it("trims text and stores blank optional text as null", () => {
    const parsed = eventSchema.parse({ ...valid, title: "  Cleanup  ", location: "   " })
    expect(parsed.title).toBe("Cleanup")
    expect(parsed.location).toBeNull()
  })

  it("requires a title", () => {
    expect(fieldErrors({ ...valid, title: "   " })).toHaveProperty("title")
  })

  it("requires the end to be after the start", () => {
    expect(fieldErrors({ ...valid, ends_at: valid.starts_at })).toEqual({ ends_at: ["End must be after the start"] })
    expect(fieldErrors({ ...valid, ends_at: "2026-12-05T13:00:00.000Z" })).toHaveProperty("ends_at")
  })

  it("compares instants, not strings, across offsets", () => {
    // 09:00-05:00 is 14:00Z, so this ends one minute after it starts.
    expect(fieldErrors({ ...valid, starts_at: "2026-12-05T09:00:00-05:00", ends_at: "2026-12-05T14:01:00Z" })).toEqual({})
  })

  it("requires a positive whole-number capacity when given", () => {
    expect(fieldErrors({ ...valid, capacity: 0 })).toHaveProperty("capacity")
    expect(fieldErrors({ ...valid, capacity: -3 })).toHaveProperty("capacity")
    expect(fieldErrors({ ...valid, capacity: 2.5 })).toHaveProperty("capacity")
    expect(fieldErrors({ ...valid, capacity: 1 })).toEqual({})
    expect(fieldErrors({ ...valid, capacity: null })).toEqual({})
  })

  it("allows a deadline up to the start, not after it", () => {
    expect(fieldErrors({ ...valid, registration_deadline: valid.starts_at })).toEqual({})
    expect(fieldErrors({ ...valid, registration_deadline: "2026-12-05T14:00:01.000Z" })).toEqual({
      registration_deadline: ["Registration deadline can't be after the start"],
    })
  })

  it("rejects timestamps without a timezone", () => {
    expect(fieldErrors({ ...valid, starts_at: "2026-12-05T14:00:00" })).toHaveProperty("starts_at")
  })

  it("does not accept a status", () => {
    expect(eventSchema.parse({ ...valid, status: "published" })).not.toHaveProperty("status")
  })
})

describe("eventUpdateSchema", () => {
  it("leaves omitted fields undefined and keeps explicit nulls", () => {
    expect(eventUpdateSchema.parse({ capacity: null })).toEqual({ capacity: null })
    expect(eventUpdateSchema.parse({})).toEqual({})
  })

  it("still validates the fields it is given", () => {
    expect(eventUpdateSchema.safeParse({ title: "" }).success).toBe(false)
    expect(eventUpdateSchema.safeParse({ capacity: 0 }).success).toBe(false)
  })
})
