import { z } from "zod"

import { createServerSupabaseClient } from "@/lib/supabase/server"

import {
  availabilitySchema,
  emergencyContactSchema,
  personalDetailsSchema,
  skillsSchema,
} from "../schemas/volunteerSchema"

export type VolunteerProfileError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "no-profile" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type VolunteerProfileResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VolunteerProfileError }

// Everything editable here minus consent - that's never part of this
// payload at all, see updateVolunteerProfile's doc comment.
const volunteerProfileUpdateSchema = personalDetailsSchema
  .merge(availabilitySchema)
  .merge(skillsSchema)
  .merge(emergencyContactSchema)

export type VolunteerProfileUpdate = z.infer<typeof volunteerProfileUpdateSchema>

function toProfileColumns(payload: VolunteerProfileUpdate) {
  return {
    phone: payload.phone,
    location: payload.location,
    availability_days: payload.weekdays,
    shift_preference: payload.shiftPreference,
    skills: payload.skills,
    emergency_contact_name: payload.emergencyContactName,
    emergency_contact_phone: payload.emergencyContactPhone,
    emergency_contact_relationship: payload.emergencyContactRelationship,
  }
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Updates an existing volunteer's phone, location, availability, shift
 * preference, skills, and emergency contact. Never touches `status` or
 * `consent_accepted_at`:
 * - `status` isn't even in the API's column grant for this table (see
 *   supabase/migrations/20261104002935_access_control.sql) - status changes
 *   only through FOR-78, never through this function, for either caller.
 * - `consent_accepted_at` is stamped once at onboarding
 *   (submitVolunteerOnboarding) and never re-sent here. Leaving it out of
 *   the update payload entirely means `guard_volunteer_consent` sees the
 *   same value on both sides of the row and leaves it untouched - there's
 *   no "re-consent on every profile save" path to guard against because
 *   this function never offers one.
 * - Name (`users.first_name`/`last_name`, set at signup) and email aren't
 *   editable through this table at all.
 *
 * `updateVolunteerProfile` takes an explicit `volunteerId` so the same
 * function serves both callers the RLS policy "volunteers: update self,
 * staff update own org" allows: the volunteer themself, or staff editing
 * someone in their organization. RLS decides who may actually touch which
 * row - a `volunteerId` that isn't the caller's own and isn't in their
 * organization comes back as `not-found`, not a thrown error, so this never
 * reveals whether the row exists elsewhere.
 */
export async function updateVolunteerProfile(
  volunteerId: string,
  input: unknown
): Promise<VolunteerProfileResult<{ id: string }>> {
  const parsed = volunteerProfileUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const { data, error } = await supabase
    .from("volunteers")
    .update(toProfileColumns(parsed.data))
    .eq("id", volunteerId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }
  if (!data) {
    return { ok: false, error: { type: "not-found" } }
  }

  return { ok: true, data }
}

/** Convenience for the common case: a volunteer updating their own profile. */
export async function updateMyVolunteerProfile(
  input: unknown
): Promise<VolunteerProfileResult<{ id: string }>> {
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

  return updateVolunteerProfile(volunteer.id, input)
}
