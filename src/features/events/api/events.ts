import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { getUserRole } from "@/features/auth"
import type { Event } from "@/lib/adapters/types"
import type { Database, Enums } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

import { deriveEventState } from "../utils/eventState"

export type EventQueryError =
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "backend"; message: string }

export type MyEventsError =
  | { type: "unauthenticated" }
  | { type: "no-profile" }
  | { type: "backend"; message: string }

export type EventQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventQueryError }

export type MyEventsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MyEventsError }

/** Filters shared by the volunteer and staff event queries. */
interface EventFilters {
  /** Matched against the title, case-insensitively, as a substring. */
  name?: string
  category?: string
  /** Matched against the location, case-insensitively, as a substring. */
  location?: string
  /** ISO timestamp - only events starting at or after this. */
  startsAfter?: string
  /** ISO timestamp - only events starting at or before this. */
  startsBefore?: string
}

export interface OpportunityFilters extends EventFilters {
  /**
   * Only events that are still joinable right now: published, not yet
   * started, before any registration deadline, and under capacity. "Full"
   * and "closed" are derived, not stored (see docs/role-model.md), so this
   * is computed here rather than queried directly.
   */
  onlyAvailable?: boolean
}

export interface StaffEventFilters extends EventFilters {
  /** One status or several; omit for every status, drafts included. */
  status?: Enums<"event_status"> | Enums<"event_status">[]
  /**
   * A calendar window (month, week, or day): events that overlap it, so a
   * multi-day event shows on every day it spans. The caller computes the
   * bounds in the viewer's timezone. `to` is exclusive.
   */
  range?: { from: string; to: string }
}

export interface MyEvents {
  upcoming: Event[]
  completed: Event[]
  cancelled: Event[]
}

// registration_count is a computed column, so it has to be asked for by name
// (see src/lib/adapters/supabase/index.ts).
const EVENT_COLUMNS = "*, registration_count"

function isAvailable(event: Event, now: number): boolean {
  return deriveEventState(event, now).registration === "open"
}

// Escapes ilike's wildcards so a search for "50%" matches the literal text.
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** The events query with the shared filters applied; callers add their own and order it. */
function filteredEvents(supabase: SupabaseClient<Database>, filters: EventFilters) {
  let query = supabase.from("events").select(EVENT_COLUMNS)
  if (filters.name) query = query.ilike("title", likePattern(filters.name))
  if (filters.category) query = query.eq("category", filters.category)
  if (filters.location) query = query.ilike("location", likePattern(filters.location))
  if (filters.startsAfter) query = query.gte("starts_at", filters.startsAfter)
  if (filters.startsBefore) query = query.lte("starts_at", filters.startsBefore)
  return query
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Both functions query `events`/`registrations` directly rather than
 * through the `eventRepo` in src/lib/adapters: that repository's mock
 * implementation has no concept of a signed-in user or organization (every
 * row is visible), which is the opposite of what "volunteer-authorized" and
 * "tenant isolation" need here. RLS is the single source of truth for both,
 * same as the rest of this feature.
 *
 * Backend queries only - no event-discovery or My Events screens here.
 */
export async function getOpportunities(
  filters: OpportunityFilters = {}
): Promise<EventQueryResult<Event[]>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const query = filteredEvents(supabase, filters)

  const { data, error } = await query.order("starts_at")
  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }

  const events = data ?? []
  if (!filters.onlyAvailable) {
    return { ok: true, data: events }
  }

  const now = Date.now()
  return { ok: true, data: events.filter((event) => isAvailable(event, now)) }
}

const eventStatus = z.enum(["draft", "published", "cancelled", "completed"] satisfies Enums<"event_status">[])
const timestamp = z.iso.datetime({ offset: true })

// The status and range filters are checked at runtime because getEventsAction
// takes them straight from the client; the text filters are passed as values.
const staffFiltersSchema = z.object({
  status: z.union([eventStatus, z.array(eventStatus)]).optional(),
  range: z
    .object({ from: timestamp, to: timestamp })
    .refine((r) => Date.parse(r.to) > Date.parse(r.from), { message: "Range must end after it starts" })
    .optional(),
})

/**
 * Every event in the staff member's organization, drafts included, for the
 * admin calendar and list (FOR-80). Staff-only (admin and manager); RLS
 * scopes the rows to the caller's organization. Same filters as
 * getOpportunities, plus status and a calendar window.
 */
export async function getEvents(filters: StaffEventFilters = {}): Promise<EventQueryResult<Event[]>> {
  const parsed = staffFiltersSchema.safeParse(filters ?? {})
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }
  const { status, range } = parsed.data

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const role = await getUserRole(user)
  if (role !== "admin" && role !== "manager") return { ok: false, error: { type: "forbidden" } }

  let query = filteredEvents(supabase, filters)
  // An empty list means no status filter, same as omitting it.
  const statuses = status === undefined ? [] : Array.isArray(status) ? status : [status]
  if (statuses.length > 0) query = query.in("status", statuses)
  if (range) query = query.lt("starts_at", range.to).gt("ends_at", range.from)

  const { data, error } = await query.order("starts_at")
  if (error) return { ok: false, error: { type: "backend", message: error.message } }
  return { ok: true, data: data ?? [] }
}

/**
 * The caller's own registered events, bucketed by outcome. Queries through
 * `registrations` (not a plain `events` filter), so an event that's since
 * been cancelled or completed stays visible here, matching the RLS policy's
 * "events: read published or registered, staff read all."
 *
 * Bucketing: the volunteer's own cancellation always wins ("cancelled"),
 * then the event's own status - an event the organizer cancelled also
 * counts as "cancelled" even if the volunteer never cancelled their spot.
 * Everything else still published is "upcoming."
 */
export async function getMyEvents(): Promise<MyEventsResult<MyEvents>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (volunteerError) {
    return { ok: false, error: { type: "backend", message: volunteerError.message } }
  }
  if (!volunteer) {
    return { ok: false, error: { type: "no-profile" } }
  }

  const { data: registrations, error: registrationsError } = await supabase
    .from("registrations")
    .select("status, event_id")
    .eq("volunteer_id", volunteer.id)

  if (registrationsError) {
    return { ok: false, error: { type: "backend", message: registrationsError.message } }
  }
  if (!registrations || registrations.length === 0) {
    return { ok: true, data: { upcoming: [], completed: [], cancelled: [] } }
  }

  const registrationByEventId = new Map(registrations.map((r) => [r.event_id, r.status]))

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .in("id", [...registrationByEventId.keys()])
    .order("starts_at")

  if (eventsError) {
    return { ok: false, error: { type: "backend", message: eventsError.message } }
  }

  const result: MyEvents = { upcoming: [], completed: [], cancelled: [] }
  for (const event of events ?? []) {
    const registrationStatus = registrationByEventId.get(event.id)
    if (registrationStatus === "cancelled" || event.status === "cancelled") {
      result.cancelled.push(event)
    } else if (event.status === "completed") {
      result.completed.push(event)
    } else {
      result.upcoming.push(event)
    }
  }

  return { ok: true, data: result }
}
