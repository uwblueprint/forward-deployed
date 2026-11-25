import { z } from "zod"

import { getUserRole } from "@/features/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

import { userNameSchema, type UserName } from "../schemas/volunteerSchema"

export type UserNameError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type UserNameResult<T> = { ok: true; data: T } | { ok: false; error: UserNameError }

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Changes someone's first and last name on `public.users`. Everyone can
 * rename themselves; only an admin renames someone else in their
 * organization (FOR-65). The role check here gives a manager a clear
 * `forbidden`; RLS ("users: update self, admins update own org") is what
 * actually enforces it, and a user outside the caller's organization reads
 * as not found.
 */
export async function updateUserName(userId: string, input: unknown): Promise<UserNameResult<UserName>> {
  const parsed = userNameSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  if (userId !== user.id && (await getUserRole(user)) !== "admin") {
    return { ok: false, error: { type: "forbidden" } }
  }

  if (!z.guid().safeParse(userId).success) return { ok: false, error: { type: "not-found" } }

  const { data, error } = await supabase
    .from("users")
    .update({ first_name: parsed.data.firstName, last_name: parsed.data.lastName })
    .eq("id", userId)
    .select("first_name, last_name")
    .maybeSingle()

  if (error) return { ok: false, error: { type: "backend", message: error.message } }
  if (!data) return { ok: false, error: { type: "not-found" } }

  return { ok: true, data: { firstName: data.first_name ?? "", lastName: data.last_name ?? "" } }
}
