import { z } from "zod"
import type { AppRole } from "@/lib/adapters/types"
import { setUserRoleSchema } from "../schemas"
import { adminSession } from "./session"

export type SetUserRoleReason = "self" | "not-found" | "forbidden" | "backend"

export type SetUserRoleResult =
  | { ok: true }
  | { ok: false; reason: "validation"; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: SetUserRoleReason | "unauthenticated" }

/**
 * Plain server-side function - not a Server Action. Call from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * Changes a member's role via the set_user_role RPC, admin-only. The RPC
 * itself enforces that an admin can't change their own role.
 */
export async function setUserRole(targetUserId: string, newRole: AppRole): Promise<SetUserRoleResult> {
  const parsed = setUserRoleSchema.safeParse({ targetUserId, newRole })
  if (!parsed.success) {
    return { ok: false, reason: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const session = await adminSession()
  if (!session.ok) {
    return { ok: false, reason: session.error.type === "unauthenticated" ? "unauthenticated" : "forbidden" }
  }

  const { error } = await session.supabase.rpc("set_user_role", {
    target_user_id: parsed.data.targetUserId,
    new_role: parsed.data.newRole,
  })
  if (!error) return { ok: true }

  // Messages come from set_user_role in
  // supabase/migrations/20261106020740_memberships.sql. If they change there,
  // update this mapping and its tests to match.
  switch (error.message) {
    case "You cannot change your own role":
      return { ok: false, reason: "self" }
    case "User not found in your organization":
      return { ok: false, reason: "not-found" }
    case "Only admins can change roles":
      return { ok: false, reason: "forbidden" }
    default:
      console.error("setUserRole: unrecognized set_user_role error", error.code, error.message)
      return { ok: false, reason: "backend" }
  }
}
