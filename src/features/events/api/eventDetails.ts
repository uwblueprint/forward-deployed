import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { Event } from "@/lib/adapters/types"
import type { CustomField } from "@/lib/customFieldAnswers"
import type { Database, Enums } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type VolunteerStatusError =
  | { type: "unauthenticated" }
  | { type: "backend"; message: string }

export type EventDetailsError =
  | { type: "unauthenticated" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type VolunteerStatusResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VolunteerStatusError }

export type EventDetailsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventDetailsError }

/** The caller's own registration for one event, if they ever registered. */
export interface MyRegistration {
  id: string
  status: Enums<"registration_status">
}

export interface EventDetails {
  event: Event
  /**
   * The organization's `registration` custom fields, in display order. Answers
   * are keyed by `custom_fields.id` and checked again by registerForEvent.
   */
  questions: CustomField[]
  registration: MyRegistration | null
  /** The caller's volunteer status, or null with no volunteer profile. Only "approved" can register. */
  volunteerStatus: Enums<"volunteer_status"> | null
}

// registration_count is a computed column, so it has to be asked for by name
// (same as events.ts).
const EVENT_COLUMNS = "*, registration_count"

async function myVolunteer(supabase: SupabaseClient<Database>, userId: string) {
  return supabase.from("volunteers").select("id, status").eq("user_id", userId).maybeSingle()
}

/**
 * Plain server-side functions - not Server Actions. Call them from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * The caller's volunteer status, so the event screens can say up front that
 * a pending or rejected volunteer can't register yet. Display only - the
 * registrations RLS policy is what actually refuses them.
 */
export async function getMyVolunteerStatus(): Promise<
  VolunteerStatusResult<Enums<"volunteer_status"> | null>
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const { data, error } = await myVolunteer(supabase, user.id)
  if (error) return { ok: false, error: { type: "backend", message: error.message } }
  return { ok: true, data: data?.status ?? null }
}

/**
 * One event for the volunteer event page: the event itself, the registration
 * questions to show before registering, and the caller's own registration
 * (so the page can offer cancel instead of register). RLS decides which
 * events are visible - a draft, another organization's event, or a malformed
 * id all come back as not-found.
 */
export async function getEventDetails(eventId: string): Promise<EventDetailsResult<EventDetails>> {
  if (!z.guid().safeParse(eventId).success) {
    return { ok: false, error: { type: "not-found" } }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .maybeSingle()
  if (eventError) return { ok: false, error: { type: "backend", message: eventError.message } }
  if (!event) return { ok: false, error: { type: "not-found" } }

  const [fieldsResult, volunteerResult] = await Promise.all([
    supabase
      .from("custom_fields")
      .select("*")
      .eq("organization_id", event.organization_id)
      .eq("entity_type", "registration")
      .order("position"),
    myVolunteer(supabase, user.id),
  ])
  if (fieldsResult.error) {
    return { ok: false, error: { type: "backend", message: fieldsResult.error.message } }
  }
  if (volunteerResult.error) {
    return { ok: false, error: { type: "backend", message: volunteerResult.error.message } }
  }

  const volunteer = volunteerResult.data
  let registration: MyRegistration | null = null
  if (volunteer) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("volunteer_id", volunteer.id)
      .maybeSingle()
    if (error) return { ok: false, error: { type: "backend", message: error.message } }
    registration = data
  }

  return {
    ok: true,
    data: {
      event,
      questions: fieldsResult.data ?? [],
      registration,
      volunteerStatus: volunteer?.status ?? null,
    },
  }
}
