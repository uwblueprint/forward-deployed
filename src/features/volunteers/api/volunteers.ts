import { z } from "zod"

import { createServerSupabaseClient } from "@/lib/supabase/server"

import { volunteerOnboardingSchema } from "../schemas/volunteerSchema"

export type VolunteerOnboardingError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "backend"; message: string }

export type VolunteerOnboardingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VolunteerOnboardingError }

function validationError(fieldErrors: Record<string, string[]>): VolunteerOnboardingError {
  return { type: "validation", fieldErrors }
}

function backendError(message: string): VolunteerOnboardingError {
  return { type: "backend", message }
}

// The guard_volunteer_consent trigger stamps the authoritative time itself
// on insert/update; this constant only needs to be non-null to signal
// "consent given now" and is never read back as the real timestamp, so it
// isn't derived from the client's clock.
const CONSENT_GIVEN_SIGNAL = new Date(0).toISOString()

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Writes the completed onboarding form to `public.volunteers` (phone,
 * location, availability, skills, emergency contact, consent) and
 * `public.users` (first_name, last_name) for the current authenticated
 * user. Re-validates server-side via the same schema the wizard already
 * validated client-side against - never trust client validation alone.
 *
 * Field mapping notes (see supabase/migrations/20261027220355_create_tables.sql
 * and .../20261104002935_access_control.sql):
 * - `weekdays` -> `availability_days` (same allowed values, different column name)
 * - `agreedToTerms` (boolean) -> `consent_accepted_at` (timestamptz): the
 *   guard_volunteer_consent trigger stamps the authoritative time itself on
 *   insert/update, so any non-null timestamp here just signals "yes, now."
 * - `firstName`/`lastName` go to `users`, not `volunteers` - there's no name
 *   column on `volunteers`. `email` isn't submitted at all: it's mirrored
 *   onto `users.email` from `auth.users` by a DB trigger and isn't grantable
 *   to update through this form.
 */
export async function submitVolunteerOnboarding(
  input: unknown
): Promise<VolunteerOnboardingResult<null>> {
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

  const payload = parsed.data

  const { error: volunteersError } = await supabase.from("volunteers").insert({
    user_id: user.id,
    phone: payload.phone,
    location: payload.location,
    availability_days: payload.weekdays,
    shift_preference: payload.shiftPreference,
    skills: payload.skills,
    emergency_contact_name: payload.emergencyContactName,
    emergency_contact_phone: payload.emergencyContactPhone,
    emergency_contact_relationship: payload.emergencyContactRelationship,
    consent_accepted_at: CONSENT_GIVEN_SIGNAL,
  })

  if (volunteersError) {
    return { ok: false, error: backendError(volunteersError.message) }
  }

  const { error: usersError } = await supabase
    .from("users")
    .update({ first_name: payload.firstName, last_name: payload.lastName })
    .eq("id", user.id)

  if (usersError) {
    return { ok: false, error: backendError(usersError.message) }
  }

  return { ok: true, data: null }
}
