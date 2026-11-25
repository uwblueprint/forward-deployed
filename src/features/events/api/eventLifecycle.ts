import { z } from "zod"

import { getUserRole } from "@/features/auth"
import type { Event } from "@/lib/adapters/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

import { EVENT_TRANSITIONS, transitionBlocker, type EventStatus } from "../utils/eventState"

export type EventTransitionError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "invalid-transition"; from: EventStatus; to: EventStatus; reason: string }
  /** The status changed between reading and writing; reload and retry. */
  | { type: "conflict" }
  | { type: "backend"; message: string }

export type EventTransitionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventTransitionError }

const inputSchema = z.object({
  eventId: z.guid(),
  status: z.enum(Object.keys(EVENT_TRANSITIONS) as [EventStatus, ...EventStatus[]]),
})

const EVENT_COLUMNS = "*, registration_count"
const RLS_VIOLATION = "42501"
const INVALID_STATE = "55000"

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Staff-only (admin and manager, matching the events RLS). Moves an event to
 * a new status if EVENT_TRANSITIONS and transitionBlocker allow it. The write
 * only applies if the status is still the one that was checked, so two staff
 * changing the same event at once can't skip a rule. The audit log records
 * the change through the events record_audit trigger.
 */
export async function changeEventStatus(
  eventId: string,
  status: EventStatus
): Promise<EventTransitionResult<Event>> {
  const parsed = inputSchema.safeParse({ eventId, status })
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const role = await getUserRole(user)
  if (role !== "admin" && role !== "manager") return { ok: false, error: { type: "forbidden" } }

  const { data: event, error: readError } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .maybeSingle()
  if (readError) return { ok: false, error: { type: "backend", message: readError.message } }
  if (!event) return { ok: false, error: { type: "not-found" } }

  if (event.status === status) return { ok: true, data: event }

  let reason = transitionBlocker(event, status)
  if (!reason && status === "draft") {
    // registration_count only counts active sign-ups, but volunteers whose
    // registration was cancelled still see the event (docs/role-model.md),
    // and a draft would vanish for them.
    const { count, error: countError } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
    if (countError) return { ok: false, error: { type: "backend", message: countError.message } }
    if (count) reason = "An event people have registered for can't go back to draft; cancel it instead"
  }
  if (reason) return { ok: false, error: { type: "invalid-transition", from: event.status, to: status, reason } }

  const { data: updated, error: writeError } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .eq("status", event.status)
    .select(EVENT_COLUMNS)
    .maybeSingle()
  if (writeError) {
    if (writeError.code === RLS_VIOLATION) return { ok: false, error: { type: "forbidden" } }
    // The database applies the same transition rules (guard_event_status). It
    // only disagrees with the check above if the event changed in between.
    if (writeError.code === INVALID_STATE) return { ok: false, error: { type: "conflict" } }
    return { ok: false, error: { type: "backend", message: writeError.message } }
  }
  if (!updated) return { ok: false, error: { type: "conflict" } }
  return { ok: true, data: updated }
}
