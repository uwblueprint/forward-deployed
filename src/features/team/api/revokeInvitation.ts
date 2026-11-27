import { z } from "zod"
import { revokeInvitationSchema } from "../schemas"
import { adminSession } from "./session"

export type RevokeInvitationReason = "not-found" | "forbidden" | "backend"

export type RevokeInvitationResult =
  | { ok: true }
  | { ok: false; reason: "validation"; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: RevokeInvitationReason | "unauthenticated" }

/**
 * Plain server-side function - not a Server Action. Call from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * Revokes an invite via the revoke_invitation RPC, admin-only. The RPC
 * collapses "doesn't exist", "wrong organization", "already revoked", and
 * "already redeemed" into the same not-found error - it doesn't distinguish
 * them, so neither does this wrapper.
 */
export async function revokeInvitation(invitationId: string): Promise<RevokeInvitationResult> {
  const parsed = revokeInvitationSchema.safeParse({ invitationId })
  if (!parsed.success) {
    return { ok: false, reason: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const session = await adminSession()
  if (!session.ok) {
    return { ok: false, reason: session.error.type === "unauthenticated" ? "unauthenticated" : "forbidden" }
  }

  const { error } = await session.supabase.rpc("revoke_invitation", {
    target_invitation_id: parsed.data.invitationId,
  })
  if (!error) return { ok: true }

  if (error.code === "P0002") return { ok: false, reason: "not-found" }

  // Messages come from revoke_invitation in
  // supabase/migrations/20261106020744_invitations.sql. If they change
  // there, update this mapping and its tests to match.
  switch (error.message) {
    case "Only admins can revoke invitations":
      return { ok: false, reason: "forbidden" }
    default:
      console.error("revokeInvitation: unrecognized revoke_invitation error", error.code, error.message)
      return { ok: false, reason: "backend" }
  }
}
