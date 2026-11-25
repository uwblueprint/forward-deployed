import { createServerSupabaseClient } from "@/lib/supabase/server"

export type RedeemInviteReason =
  | "not-found"
  | "expired"
  | "revoked"
  | "used"
  | "wrong-email"
  | "unconfirmed-email"
  | "already-member"

export type RedeemInviteResult =
  | { ok: true; organizationId: string }
  | { ok: false; reason: RedeemInviteReason | "unauthenticated" }

/**
 * Plain server-side function - not a Server Action. Call from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * Redeems an invite token for the signed-in caller via the redeem_invitation
 * RPC, translating its Postgres errors into a typed reason the caller can
 * route on without parsing Postgres errors itself.
 */
export async function redeemInvite(token: string): Promise<RedeemInviteResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: "unauthenticated" }

  const { data, error } = await supabase.rpc("redeem_invitation", { invitation_token: token })
  if (!error) return { ok: true, organizationId: data }

  if (error.code === "P0002") return { ok: false, reason: "not-found" }

  // Messages come from redeem_invitation in
  // supabase/migrations/20261111015832_single_org.sql. If they change there,
  // update this mapping and its tests to match.
  switch (error.message) {
    case "Invitation already used":
      return { ok: false, reason: "used" }
    case "Invitation revoked":
      return { ok: false, reason: "revoked" }
    case "Invitation expired":
      return { ok: false, reason: "expired" }
    case "This invitation is for a different email address":
      return { ok: false, reason: "wrong-email" }
    case "Confirm your email address first":
      return { ok: false, reason: "unconfirmed-email" }
    case "You already belong to an organization":
      return { ok: false, reason: "already-member" }
    default:
      console.error("redeemInvite: unrecognized redeem_invitation error", error.code, error.message)
      return { ok: false, reason: "not-found" } // unrecognized -> generic invalid link
  }
}
