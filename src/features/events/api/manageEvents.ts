import { z } from "zod"

import { eventRepo, type Event } from "@/lib/adapters"
import { createServerSupabaseClient } from "@/lib/supabase/server"

import { eventDateErrors, eventSchema, eventUpdateSchema } from "../schemas/eventSchema"

export type EventMutationError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type EventMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: EventMutationError }

// 42501 insufficient_privilege: the events RLS rejected the write (not staff,
// or not the caller's organization). The date and capacity checks are
// validated first, so a 23514 check_violation here means a concurrent edit
// moved the stored dates; it falls through as a backend error.
const RLS_VIOLATION = "42501"

const STAFF_ROLES = ["admin", "manager"]

function mapWriteError(error: unknown): EventMutationError {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  if (code === RLS_VIOLATION) return { type: "forbidden" }
  return { type: "backend", message: message ?? "Unknown error" }
}

/**
 * The caller's organization, if they're staff there. Organization isolation
 * rests on this: events are always created in the caller's own organization,
 * never one taken from input. RLS enforces the same rule underneath.
 */
async function requireStaffOrganization(): Promise<
  { ok: true; organizationId: string } | { ok: false; error: EventMutationError }
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return { ok: false, error: { type: "backend", message: error.message } }
  if (!membership || !STAFF_ROLES.includes(membership.role)) {
    return { ok: false, error: { type: "forbidden" } }
  }
  return { ok: true, organizationId: membership.organization_id }
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Staff-only (admin and manager, matching the events RLS). Inputs are
 * validated against the same rules as the events table's check constraints
 * (end after start, capacity of at least 1, registration deadline no later
 * than the start), so a bad date comes back as a field error, not a database
 * error. New events start as drafts, and status can't be set here; lifecycle
 * transitions are FOR-80's. The audit log records creation and status changes
 * through database triggers, so nothing is written to it from here.
 */
export async function createEvent(input: unknown): Promise<EventMutationResult<Event>> {
  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const staff = await requireStaffOrganization()
  if (!staff.ok) return staff

  try {
    const event = await eventRepo.create({ ...parsed.data, organization_id: staff.organizationId })
    return { ok: true, data: event }
  } catch (error) {
    return { ok: false, error: mapWriteError(error) }
  }
}

/**
 * Changes only the fields given; null clears an optional one. The date rules
 * are checked on the stored dates merged with the new ones, so moving just the
 * start still can't put it after the end. An event in another organization
 * reads as not found.
 */
export async function updateEvent(id: string, input: unknown): Promise<EventMutationResult<Event>> {
  const parsed = eventUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }
  // Keys the caller left out stay untouched.
  const changes = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  ) as typeof parsed.data

  const staff = await requireStaffOrganization()
  if (!staff.ok) return staff

  try {
    const current = await eventRepo.getById(id)
    if (!current) return { ok: false, error: { type: "not-found" } }

    const dateErrors = eventDateErrors({ ...current, ...changes })
    if (Object.keys(dateErrors).length > 0) {
      return { ok: false, error: { type: "validation", fieldErrors: dateErrors } }
    }

    if (Object.keys(changes).length === 0) return { ok: true, data: current }
    return { ok: true, data: await eventRepo.update(id, changes) }
  } catch (error) {
    return { ok: false, error: mapWriteError(error) }
  }
}
