import type { Json } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlainObject } from "@/lib/isPlainObject"

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

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * In-progress application answers, before submission - entirely separate
 * from `public.applications`, which is immutable once a row exists (see
 * docs/role-model.md, "Applications and volunteer status": no RLS policy or
 * column grant ever lets a volunteer edit a submitted application).
 * `application_drafts` has exactly one row per volunteer (volunteer_id is
 * its primary key), owner-only (not even staff can read it - nobody
 * reviews a draft), replaced wholesale on every save.
 *
 * loadDraft/deleteDraft don't look up the caller's volunteer_id themselves:
 * the table's RLS policy already restricts every row to
 * `volunteer_id = current_volunteer_id()`, and since that's the primary
 * key there's at most one row either way - an explicit app-side filter
 * would just be re-deriving what RLS already guarantees. saveDraft is
 * different: an insert/upsert needs an actual volunteer_id *value* to
 * write, which RLS can validate but can't supply.
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

  // PostgREST's generated upsert always puts every submitted column,
  // including the conflict target (volunteer_id), in the UPDATE's SET list
  // - hence the UPDATE grant on volunteer_id in the migration, even though
  // its value never actually changes (RLS's with check still blocks
  // setting it to anyone else's).
  const { error } = await supabase
    .from("application_drafts")
    // responses is only known to be a plain object here, not recursively
    // JSON-safe (isPlainObject doesn't check that deeply) - same trust
    // boundary as any other "store whatever JSON-looking value was sent"
    // jsonb write.
    .upsert({ volunteer_id: volunteer.id, responses: responses as Record<string, Json> }, { onConflict: "volunteer_id" })

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }

  return { ok: true, data: null }
}

/** The caller's own draft, or `null` if they haven't saved one. */
export async function loadDraft(): Promise<ApplicationDraftResult<ApplicationDraft | null>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const { data, error } = await supabase.from("application_drafts").select("responses, updated_at").maybeSingle()

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
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  // No filter needed: RLS's using clause already restricts this DELETE to
  // the caller's own row (volunteer_id = current_volunteer_id()), and since
  // that's the primary key there's at most one.
  const { error } = await supabase.from("application_drafts").delete()

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }

  return { ok: true, data: null }
}
