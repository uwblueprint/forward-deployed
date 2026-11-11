import { z } from "zod"

import { createServerSupabaseClient } from "@/lib/supabase/server"

import { volunteerOnboardingSchema } from "../schemas/volunteerSchema"

export type VolunteerApplicationError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "no-profile" }
  | { type: "duplicate" }
  | { type: "not-eligible" }
  | { type: "backend"; message: string }

export type VolunteerApplicationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VolunteerApplicationError }

// Postgres SQLSTATEs the applications RLS/unique-index layer can raise here
// (see supabase/migrations/20261027220355_create_tables.sql and
// .../20261104002935_access_control.sql):
// - 23505 unique_violation: applications_one_pending_per_volunteer already
//   has an open (pending) row for this volunteer.
// - 42501 insufficient_privilege: the "applications: volunteers apply" RLS
//   check failed - the only way that happens for a self-submitted insert is
//   is_approved_volunteer() being true (an approved volunteer must wait to
//   be reviewed again, not reapply).
const UNIQUE_VIOLATION = "23505"
const RLS_VIOLATION = "42501"

function validationError(fieldErrors: Record<string, string[]>): VolunteerApplicationError {
  return { type: "validation", fieldErrors }
}

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Persists a pending `public.applications` row for the current
 * authenticated user's existing volunteer profile (see docs/role-model.md,
 * "Applications and volunteer status"). This is deliberately separate from
 * `submitVolunteerOnboarding` (src/features/volunteers/api/volunteers.ts),
 * which only creates/updates the profile itself - creating a profile and
 * applying are two distinct steps in the agreed model.
 *
 * Re-validates server-side via the same schema the onboarding wizard
 * validates client-side against (FOR-32) - never trust client validation
 * alone. Ownership and duplicate-submission protection are not re-implemented
 * here: the volunteer_id is always the caller's own (never taken from
 * input), and the database's RLS check plus the
 * `applications_one_pending_per_volunteer` partial unique index are the
 * single atomic source of truth for "is this caller allowed to apply" and
 * "do they already have an open application." This function only translates
 * those outcomes into a typed result for the caller.
 *
 * Deliberately backend-only: no wizard integration here. The returned `id`
 * is for a later ticket to use for frontend draft cleanup.
 */
export async function submitVolunteerApplication(
  input: unknown
): Promise<VolunteerApplicationResult<{ id: string }>> {
  const parsed = volunteerOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: validationError(z.flattenError(parsed.error).fieldErrors) }
  }

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

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({ volunteer_id: volunteer.id, responses: parsed.data })
    .select("id")
    .single()

  if (applicationError) {
    if (applicationError.code === UNIQUE_VIOLATION) {
      return { ok: false, error: { type: "duplicate" } }
    }
    if (applicationError.code === RLS_VIOLATION) {
      return { ok: false, error: { type: "not-eligible" } }
    }
    return { ok: false, error: { type: "backend", message: applicationError.message } }
  }

  return { ok: true, data: { id: application.id } }
}
