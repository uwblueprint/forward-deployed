import { createServerSupabaseClient } from "@/lib/supabase/server"
import { validateCustomFieldAnswers } from "@/lib/customFieldAnswers"

export type EventRegistrationError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "no-profile" }
  | { type: "event-not-found" }
  | { type: "already-registered" }
  | { type: "full" }
  | { type: "not-eligible" }
  | { type: "backend"; message: string }

export type EventCancellationError =
  | { type: "unauthenticated" }
  | { type: "not-found" }
  | { type: "not-eligible" }
  | { type: "backend"; message: string }

export type EventRegistrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventRegistrationError }

export type EventCancellationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventCancellationError }

// Postgres SQLSTATEs the registrations RLS/triggers can raise here (see
// supabase/migrations/20261027220355_create_tables.sql,
// .../20261104002935_access_control.sql, and .../20261106020742_registration_rules.sql):
// - 23505 unique_violation: a (event_id, volunteer_id) row already exists -
//   re-registering updates that row's status instead of inserting again.
// - 23514 check_violation: enforce_event_capacity found the event full.
// - 42501 insufficient_privilege: the RLS check failed - not an approved
//   volunteer, the event isn't open (not published / started / past its
//   registration deadline), or (for cancellation) attendance was already
//   recorded or the event is completed.
const UNIQUE_VIOLATION = "23505"
const CAPACITY_VIOLATION = "23514"
const RLS_VIOLATION = "42501"

type Row = { id: string }

function mapWriteError(error: { code?: string; message: string }): EventRegistrationError {
  if (error.code === UNIQUE_VIOLATION) return { type: "already-registered" }
  if (error.code === CAPACITY_VIOLATION) return { type: "full" }
  if (error.code === RLS_VIOLATION) return { type: "not-eligible" }
  return { type: "backend", message: error.message }
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Self-service only: the caller always registers/cancels their own
 * volunteer_id, never one supplied by input. Eligibility (approved
 * volunteer, open event), duplicate prevention, and capacity are not
 * re-checked here - the RLS policies and the row-locked
 * `enforce_event_capacity` trigger are the single atomic source of truth
 * (see supabase/tests/concurrency.sh for the race this guarantees against).
 * This function only resolves the caller's volunteer_id, validates
 * organization-configured registration questions, and translates the
 * database's outcome into a typed result.
 *
 * No registration frontend wiring here - that's a later ticket.
 */
export async function registerForEvent(
  eventId: string,
  responses: unknown = {}
): Promise<EventRegistrationResult<Row>> {
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

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("organization_id")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError) {
    return { ok: false, error: { type: "backend", message: eventError.message } }
  }
  if (!event) {
    return { ok: false, error: { type: "event-not-found" } }
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("organization_id", event.organization_id)
    .eq("entity_type", "registration")

  if (fieldsError) {
    return { ok: false, error: { type: "backend", message: fieldsError.message } }
  }

  const validated = validateCustomFieldAnswers(fields ?? [], responses)
  if (!validated.ok) {
    return { ok: false, error: { type: "validation", fieldErrors: validated.fieldErrors } }
  }

  const { data: existing, error: existingError } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("volunteer_id", volunteer.id)
    .maybeSingle()

  if (existingError) {
    return { ok: false, error: { type: "backend", message: existingError.message } }
  }

  if (existing) {
    if (existing.status === "registered") {
      return { ok: false, error: { type: "already-registered" } }
    }

    // Re-registering: only the status moves back to "registered" - a
    // volunteer can never change custom_responses themselves
    // (guard_registrations_update), so this round's answers aren't written.
    const { data, error } = await supabase
      .from("registrations")
      .update({ status: "registered" })
      .eq("id", existing.id)
      .select("id")
      .single()

    if (error) {
      return { ok: false, error: mapWriteError(error) }
    }
    return { ok: true, data }
  }

  const { data, error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, volunteer_id: volunteer.id, custom_responses: validated.data })
    .select("id")
    .single()

  if (error) {
    return { ok: false, error: mapWriteError(error) }
  }
  return { ok: true, data }
}

export async function cancelRegistration(registrationId: string): Promise<EventCancellationResult<Row>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const { data, error } = await supabase
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", registrationId)
    .select("id")
    .maybeSingle()

  if (error) {
    if (error.code === RLS_VIOLATION) {
      return { ok: false, error: { type: "not-eligible" } }
    }
    return { ok: false, error: { type: "backend", message: error.message } }
  }
  if (!data) {
    return { ok: false, error: { type: "not-found" } }
  }
  return { ok: true, data }
}
