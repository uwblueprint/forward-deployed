import { getUserRole } from "@/features/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type TeamError =
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "backend"; message: string }

export type TeamResult<T> = { ok: true; data: T } | { ok: false; error: TeamError }

/** Every Team query is admin-only, even though RLS also lets managers read these tables. */
export async function adminSession() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: { type: "unauthenticated" as const } }

  const role = await getUserRole(user)
  if (role !== "admin") return { ok: false as const, error: { type: "forbidden" as const } }

  return { ok: true as const, supabase, userId: user.id }
}
