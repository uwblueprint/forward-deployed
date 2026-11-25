// The volunteer event list's filters, as they live in the URL. Pure, so the
// page (server) and the filter bar (client) share one definition.
import type { OpportunityFilters } from "../api/events"
import { dayRangeToBounds, isCalendarDay } from "./formatEvent"

export interface EventFilterValues {
  /** Name search. */
  q: string
  category: string
  location: string
  /** YYYY-MM-DD, inclusive, in EVENT_TIME_ZONE. */
  from: string
  /** YYYY-MM-DD, inclusive, in EVENT_TIME_ZONE. */
  to: string
}

const KEYS = ["q", "category", "location", "from", "to"] as const satisfies readonly (keyof EventFilterValues)[]

export const EMPTY_EVENT_FILTERS: EventFilterValues = { q: "", category: "", location: "", from: "", to: "" }

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

/** Reads the filters from a page's searchParams, dropping malformed dates. */
export function parseEventFilters(params: SearchParams): EventFilterValues {
  const values = { ...EMPTY_EVENT_FILTERS }
  for (const key of KEYS) values[key] = first(params[key]).slice(0, 200)
  if (values.from && !isCalendarDay(values.from)) values.from = ""
  if (values.to && !isCalendarDay(values.to)) values.to = ""
  return values
}

export function hasEventFilters(values: EventFilterValues): boolean {
  return KEYS.some((key) => values[key] !== "")
}

export function toOpportunityFilters(values: EventFilterValues): OpportunityFilters {
  return {
    name: values.q || undefined,
    category: values.category || undefined,
    location: values.location || undefined,
    ...dayRangeToBounds(values.from, values.to),
  }
}

/** The list URL for `values`, leaving out empty filters. */
export function eventFiltersHref(pathname: string, values: EventFilterValues): string {
  const params = new URLSearchParams()
  for (const key of KEYS) if (values[key]) params.set(key, values[key])
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
