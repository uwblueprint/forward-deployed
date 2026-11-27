import { z } from "zod"
import type { AppRole } from "@/lib/adapters/types"
import { createInvitationSchema } from "../schemas"
import { adminSession } from "./session"

export type CreateInvitationReason = "already-member" | "forbidden" | "backend"

export type CreateInvitationResult =
  | { ok: true; invitationId: string; invitePath: string }
  | { ok: false; reason: "validation"; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: CreateInvitationReason | "unauthenticated" }

/**
 * Plain server-side function - not a Server Action. Call from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * Creates an invite via the create_invitation RPC, admin-only. The RPC
 * generates the raw token and returns it exactly once here - only its hash
 * is ever stored, so this is the only place the app ever sees it.
 *
 * Returns a relative invitePath, not an absolute link: building an absolute
 * URL would need a trusted origin derived from request headers, which can
 * be spoofed. The caller (the Team page) builds the full link client-side
 * from window.location.origin instead, which comes from the admin's own
 * browser and can't be spoofed via headers.
 */
export async function createInvitation(email: string, role: AppRole): Promise<CreateInvitationResult> {
  const parsed = createInvitationSchema.safeParse({ email, role })
  if (!parsed.success) {
    return { ok: false, reason: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const session = await adminSession()
  if (!session.ok) {
    return { ok: false, reason: session.error.type === "unauthenticated" ? "unauthenticated" : "forbidden" }
  }

  const { data, error } = await session.supabase.rpc("create_invitation", {
    invitee_email: parsed.data.email,
    invitee_role: parsed.data.role,
  })
  if (error) {
    // Messages come from create_invitation in
    // supabase/migrations/20261106020744_invitations.sql. If they change
    // there, update this mapping and its tests to match.
    switch (error.message) {
      case "That person is already a member":
        return { ok: false, reason: "already-member" }
      case "Only admins can invite people":
        return { ok: false, reason: "forbidden" }
      default:
        console.error("createInvitation: unrecognized create_invitation error", error.code, error.message)
        return { ok: false, reason: "backend" }
    }
  }

  const row = data?.[0]
  if (!row) {
    console.error("createInvitation: create_invitation returned no row")
    return { ok: false, reason: "backend" }
  }

  return {
    ok: true,
    invitationId: row.invitation_id,
    invitePath: `/auth/invite?token=${encodeURIComponent(row.token)}`,
  }
}
