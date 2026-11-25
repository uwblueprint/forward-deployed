import { z } from "zod"

import { getUserRole } from "@/features/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ApplicationNoteError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "not-allowed" }
  | { type: "backend"; message: string }

export type ApplicationNoteResult =
  | { ok: true; data: { note: string | null } }
  | { ok: false; error: ApplicationNoteError }

const noteSchema = z.object({
  applicationId: z.guid(),
  note: z.string().max(5000),
})

const UNIQUE_VIOLATION = "23505"
const RLS_VIOLATION = "42501"

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Saves the admin-only internal note on an application without deciding it.
 * A blank note removes it. RLS lets only admins in the application's
 * organization read or write notes, never on their own application, so a
 * manager, a volunteer, or another organization's admin gets `not-allowed`.
 */
export async function saveApplicationNote(applicationId: string, note: string): Promise<ApplicationNoteResult> {
  const parsed = noteSchema.safeParse({ applicationId, note })
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }
  // RLS hides notes from everyone else, which would read as "nothing to
  // change" below; say so instead of reporting success.
  if ((await getUserRole(user)) !== "admin") return { ok: false, error: { type: "not-allowed" } }

  const id = parsed.data.applicationId
  const text = parsed.data.note.trim()

  if (!text) {
    const { error } = await supabase.from("application_notes").delete().eq("application_id", id)
    if (error) return { ok: false, error: { type: "backend", message: error.message } }
    return { ok: true, data: { note: null } }
  }

  // Not an upsert: the API may update internal_note but not application_id,
  // which an upsert would also set. Update first, insert if there was none.
  const update = () =>
    supabase.from("application_notes").update({ internal_note: text }).eq("application_id", id).select("internal_note")

  const updated = await update()
  if (updated.error) return { ok: false, error: { type: "backend", message: updated.error.message } }
  if (updated.data.length > 0) return { ok: true, data: { note: updated.data[0].internal_note } }

  const inserted = await supabase.from("application_notes").insert({ application_id: id, internal_note: text })
  if (inserted.error?.code === UNIQUE_VIOLATION) {
    // Another admin saved one first; theirs is replaced, as an edit would.
    const retried = await update()
    if (retried.error) return { ok: false, error: { type: "backend", message: retried.error.message } }
    if (retried.data.length === 0) return { ok: false, error: { type: "not-allowed" } }
    return { ok: true, data: { note: text } }
  }
  if (inserted.error?.code === RLS_VIOLATION) return { ok: false, error: { type: "not-allowed" } }
  if (inserted.error) return { ok: false, error: { type: "backend", message: inserted.error.message } }

  return { ok: true, data: { note: text } }
}
