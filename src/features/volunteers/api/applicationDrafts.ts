import type { Json } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ApplicationDraftError =
  | { type: "validation"; message: string }
  | { type: "unauthenticated" }
  | { type: "no-profile" }
  | { type: "backend"; message: string }

export type ApplicationDraftResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApplicationDraftError }

export interface ApplicationDraft {
  responses: Record<string, Json>
  updatedAt: string
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function resolveOwnVolunteerId(): Promise<
  | { ok: true; volunteerId: string }
  | { ok: false; error: ApplicationDraftError }
> {
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

  return { ok: true, volunteerId: volunteer.id }
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * In-progress application answers, before submission - entirely separate
 * from `public.applications`, which is immutable once a row exists (see
 * docs/role-model.md, "Applications and volunteer status": no RLS policy or
 * column grant ever lets a volunteer edit a submitted application).
 * `application_drafts` has exactly one row per volunteer, owner-only (not
 * even staff can read it - nobody reviews a draft), replaced wholesale on
 * every save.
 *
 * Deliberately permissive about shape: unlike submitVolunteerApplication,
 * which requires a fully valid payload, a draft by definition can be
 * incomplete while someone is still filling it out. The only check here is
 * that it's a plain JSON object, since that's what the `responses` jsonb
 * column needs - not the full onboarding schema.
 *
 * This is independent of, and doesn't change, the wizard's existing
 * localStorage draft (see src/components/common/forms/wizardDraft.ts) -
 * wiring the two together is a later, frontend ticket.
 */
export async function saveDraft(
  responses: unknown
): Promise<ApplicationDraftResult<null>> {
  if (!isPlainObject(responses)) {
    return { ok: false, error: { type: "validation", message: "Draft responses must be a JSON object" } }
  }

  const resolved = await resolveOwnVolunteerId()
  if (!resolved.ok) {
    return resolved
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("application_drafts")
    .upsert({ volunteer_id: resolved.volunteerId, responses }, { onConflict: "volunteer_id" })

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }

  return { ok: true, data: null }
}

/** The caller's own draft, or `null` if they haven't saved one. */
export async function loadDraft(): Promise<ApplicationDraftResult<ApplicationDraft | null>> {
  const resolved = await resolveOwnVolunteerId()
  if (!resolved.ok) {
    return resolved
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("application_drafts")
    .select("responses, updated_at")
    .eq("volunteer_id", resolved.volunteerId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }
  if (!data) {
    return { ok: true, data: null }
  }

  return {
    ok: true,
    data: { responses: data.responses as Record<string, Json>, updatedAt: data.updated_at },
  }
}

/**
 * Deletes the caller's own draft. Idempotent - succeeds whether or not one
 * existed, so a later ticket's post-submission cleanup can call this
 * unconditionally.
 */
export async function deleteDraft(): Promise<ApplicationDraftResult<null>> {
  const resolved = await resolveOwnVolunteerId()
  if (!resolved.ok) {
    return resolved
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from("application_drafts")
    .delete()
    .eq("volunteer_id", resolved.volunteerId)

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }

  return { ok: true, data: null }
}
