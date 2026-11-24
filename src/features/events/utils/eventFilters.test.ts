import { describe, expect, it } from "vitest"

import { eventFiltersHref, hasEventFilters, parseEventFilters, toOpportunityFilters } from "./eventFilters"
import { dayRangeToBounds, formatEventDay, formatEventTimeRange, spotsLeft } from "./formatEvent"

describe("parseEventFilters", () => {
  it("reads each filter, trimming and taking the first of repeated params", () => {
    expect(
      parseEventFilters({ q: "  food ", category: ["Food", "Other"], location: "Waterloo", from: "2026-11-20" })
    ).toEqual({ q: "food", category: "Food", location: "Waterloo", from: "2026-11-20", to: "" })
  })

  it("drops malformed dates", () => {
    expect(parseEventFilters({ from: "tomorrow", to: "2026-02-30" })).toMatchObject({ from: "", to: "" })
  })

  it("reports whether any filter is set", () => {
    expect(hasEventFilters(parseEventFilters({}))).toBe(false)
    expect(hasEventFilters(parseEventFilters({ location: "Kitchener" }))).toBe(true)
  })
})

describe("toOpportunityFilters", () => {
  it("maps the URL filters to getOpportunities filters, leaving blanks out", () => {
    expect(
      toOpportunityFilters({ q: "food", category: "", location: "Waterloo", from: "2026-11-20", to: "2026-11-21" })
    ).toEqual({
      name: "food",
      category: undefined,
      location: "Waterloo",
      // Toronto is UTC-5 in November.
      startsAfter: "2026-11-20T05:00:00.000Z",
      startsBefore: "2026-11-22T04:59:59.999Z",
    })
  })

  it("follows daylight saving time", () => {
    expect(dayRangeToBounds("2026-07-01", "2026-07-01")).toEqual({
      startsAfter: "2026-07-01T04:00:00.000Z",
      startsBefore: "2026-07-02T03:59:59.999Z",
    })
  })
})

describe("eventFiltersHref", () => {
  it("leaves out empty filters", () => {
    expect(eventFiltersHref("/events", { q: "beach day", category: "", location: "", from: "", to: "" })).toBe(
      "/events?q=beach+day"
    )
    expect(eventFiltersHref("/events", { q: "", category: "", location: "", from: "", to: "" })).toBe("/events")
  })
})

describe("formatEvent", () => {
  const event = { starts_at: "2026-10-31T22:00:00.000Z", ends_at: "2026-11-01T00:00:00.000Z" }

  it("formats the day and time range in Toronto time", () => {
    expect(formatEventDay(event)).toBe("Saturday, Oct 31")
    expect(formatEventTimeRange(event)).toBe("6:00 PM – 8:00 PM EDT")
  })

  it("shows each endpoint's zone when a DST switch falls inside the event", () => {
    expect(formatEventTimeRange({ starts_at: "2026-11-01T05:30:00.000Z", ends_at: "2026-11-01T06:30:00.000Z" })).toBe(
      "1:30 AM EDT – 1:30 AM EST"
    )
  })

  it("counts spots left, never below zero, and null with no capacity", () => {
    expect(spotsLeft({ capacity: 10, registration_count: 3 })).toBe(7)
    expect(spotsLeft({ capacity: 2, registration_count: 5 })).toBe(0)
    expect(spotsLeft({ capacity: null, registration_count: 5 })).toBeNull()
  })
})
