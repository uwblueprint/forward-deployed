import { z } from "zod"

import { getUserRole } from "@/features/auth"
import type { VolunteerWithUser } from "@/lib/adapters"
import type { Enums, Tables } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type EventRegistration = Pick<
  Tables<"registrations">,
  "id" | "event_id" | "status" | "custom_responses" | "created_at" | "updated_at"
> & {
  /** Null only if RLS hides the volunteer row. */
  volunteer: VolunteerWithUser | null
}

export type EventRegistrationsError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type EventRegistrationsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventRegistrationsError }

export type EventRegistrationsFilter = {
  status?: Enums<"registration_status">
}

// Checked at runtime because the Server Action wrapper takes it straight from the client.
const filterSchema = z.object({
  status: z.enum(["registered", "cancelled"] satisfies Enums<"registration_status">[]).optional(),
})

// Attendance is left out on purpose: recording it isn't approved yet (FOR-83).
const REGISTRATION_COLUMNS =
  "id, event_id, status, custom_responses, created_at, updated_at, volunteer:volunteers(*, user:users(first_name, last_name, email))"

const STAFF_ROLES = ["admin", "manager"]

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Staff-only (admin and manager, matching the registrations RLS). Lists an
 * event's registrations, oldest first, each with the volunteer's shared
 * profile and name/email. Read-only: adding or removing people, attendance,
 * and hours are out of scope.
 *
 * Tenant isolation is the RLS's job (see "admin sees org A registrations
 * only" in supabase/tests/database/access_control.test.sql): another
 * organization's event reads as not found here, and its registrations are
 * never returned.
 */
export async function getEventRegistrations(
  eventId: string,
  filter: EventRegistrationsFilter = {}
): Promise<EventRegistrationsResult<EventRegistration[]>> {
  const parsedFilter = filterSchema.safeParse(filter ?? {})
  if (!parsedFilter.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsedFilter.error).fieldErrors } }
  }
  const { status } = parsedFilter.data

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const role = await getUserRole(user)
  if (!role || !STAFF_ROLES.includes(role)) return { ok: false, error: { type: "forbidden" } }

  // A malformed id can't match any event; don't send it to Postgres as a uuid.
  // guid, not uuid: Postgres accepts ids that aren't RFC 4122 variants.
  if (!z.guid().safeParse(eventId).success) return { ok: false, error: { type: "not-found" } }

  // Separates "no registrations yet" from "no such event (or not yours)".
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle()
  if (eventError) return { ok: false, error: { type: "backend", message: eventError.message } }
  if (!event) return { ok: false, error: { type: "not-found" } }

  let query = supabase.from("registrations").select(REGISTRATION_COLUMNS).eq("event_id", eventId)
  if (status) query = query.eq("status", status)

  const { data, error } = await query.order("created_at")
  if (error) return { ok: false, error: { type: "backend", message: error.message } }
  return { ok: true, data }
}
