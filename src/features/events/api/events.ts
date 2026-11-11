import type { Event } from "@/lib/adapters/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type EventQueryError =
  | { type: "unauthenticated" }
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

export interface OpportunityFilters {
  /** Matched against the title, case-insensitively, as a substring. */
  name?: string
  category?: string
  /** Matched against the location, case-insensitively, as a substring. */
  location?: string
  /** ISO timestamp - only events starting at or after this. */
  startsAfter?: string
  /** ISO timestamp - only events starting at or before this. */
  startsBefore?: string
  /**
   * Only events that are still joinable right now: published, not yet
   * started, before any registration deadline, and under capacity. "Full"
   * and "closed" are derived, not stored (see docs/role-model.md), so this
   * is computed here rather than queried directly.
   */
  onlyAvailable?: boolean
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
  if (event.status !== "published") return false
  if (new Date(event.starts_at).getTime() <= now) return false
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() <= now) return false
  if (event.capacity != null && (event.registration_count ?? 0) >= event.capacity) return false
  return true
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

  let query = supabase.from("events").select(EVENT_COLUMNS)

  if (filters.name) {
    query = query.ilike("title", `%${filters.name}%`)
  }
  if (filters.category) {
    query = query.eq("category", filters.category)
  }
  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`)
  }
  if (filters.startsAfter) {
    query = query.gte("starts_at", filters.startsAfter)
  }
  if (filters.startsBefore) {
    query = query.lte("starts_at", filters.startsBefore)
  }

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
