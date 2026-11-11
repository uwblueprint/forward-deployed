import type { Json } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { CustomField } from "@/lib/customFieldAnswers"
import { validateCustomFieldAnswers } from "@/lib/customFieldAnswers"

export type ApplicationQuestionsError =
  | { type: "unauthenticated" }
  | { type: "no-organization" }
  | { type: "backend"; message: string }

export type ApplicationAnswersError =
  | ApplicationQuestionsError
  | { type: "validation"; fieldErrors: Record<string, string[]> }

export type ApplicationStatusError =
  | { type: "unauthenticated" }
  | { type: "no-profile" }
  | { type: "backend"; message: string }

export type ApplicationQuestionsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApplicationQuestionsError }

export type ApplicationAnswersResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApplicationAnswersError }

export type ApplicationStatusResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApplicationStatusError }

export interface ApplicationStatus {
  id: string
  status: "pending" | "approved" | "rejected"
  applicantMessage: string | null
  submittedAt: string
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * `applications.responses` is keyed by `custom_fields.id` (see
 * supabase/migrations/20261027220355_create_tables.sql's column comment),
 * so answers are always validated against the caller's own organization's
 * question definitions - never a fixed, hardcoded shape.
 *
 * No question rendering, review step, or status screens here - those are
 * later tickets.
 */
export async function getApplicationQuestions(): Promise<ApplicationQuestionsResult<CustomField[]>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  // The caller's current organization, the same source private.current_org_id()
  // reads from (see docs/role-model.md) - not volunteers.organization_id,
  // which can lag behind or be null before someone joins an organization.
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (membershipError) {
    return { ok: false, error: { type: "backend", message: membershipError.message } }
  }
  if (!membership) {
    return { ok: false, error: { type: "no-organization" } }
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .eq("entity_type", "application")
    .order("position")

  if (fieldsError) {
    return { ok: false, error: { type: "backend", message: fieldsError.message } }
  }

  return { ok: true, data: fields ?? [] }
}

/**
 * Validates a submitted application-answers payload against the caller's
 * organization's `application` custom fields. Doesn't write anything -
 * callers decide what to do with a validated payload (e.g. insert it as
 * `applications.responses`).
 */
export async function validateApplicationAnswers(
  responses: unknown
): Promise<ApplicationAnswersResult<Record<string, Json>>> {
  const questions = await getApplicationQuestions()
  if (!questions.ok) {
    return questions
  }

  const validated = validateCustomFieldAnswers(questions.data, responses)
  if (!validated.ok) {
    return { ok: false, error: { type: "validation", fieldErrors: validated.fieldErrors } }
  }

  return { ok: true, data: validated.data }
}

/**
 * The caller's own latest application (by `submitted_at`, matching
 * `private.sync_volunteer_status`'s definition of "latest"), or `null` if
 * they haven't applied. `applicantMessage` is already authoritative and
 * fully configured by the database: a rejection with no written message is
 * backfilled from the organization's `default_rejection_message`, and
 * approval clears it (see `private.review_application`) - this function
 * only reads it back, never computes it.
 *
 * There is deliberately no corresponding "update my application" operation:
 * volunteers have no RLS policy or column grant letting them edit
 * `responses`, `status`, or `applicant_message` on their own application
 * once submitted (see supabase/tests/database/access_control.test.sql,
 * "volunteer cannot review their application"). Reapplying after a
 * rejection always creates a new row (submitVolunteerApplication), never
 * edits the old one.
 */
export async function getApplicationStatus(): Promise<ApplicationStatusResult<ApplicationStatus | null>> {
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
    .select("id, status, applicant_message, submitted_at")
    .eq("volunteer_id", volunteer.id)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (applicationError) {
    return { ok: false, error: { type: "backend", message: applicationError.message } }
  }
  if (!application) {
    return { ok: true, data: null }
  }

  return {
    ok: true,
    data: {
      id: application.id,
      status: application.status,
      applicantMessage: application.applicant_message,
      submittedAt: application.submitted_at,
    },
  }
}
