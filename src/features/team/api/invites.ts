import type { UnusedInvite } from "../types"
import { adminSession, type TeamResult } from "./session"

/**
 * Plain server-side function - not a Server Action. Call from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * Invites the caller's organization can still act on: not revoked, not
 * redeemed, not expired. Never selects token_hash - the raw token is shown
 * once at creation and isn't needed again.
 */
export async function listUnusedInvites(): Promise<TeamResult<UnusedInvite[]>> {
  const session = await adminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("invitations")
    .select("id, email, role, created_at, expires_at")
    .is("revoked_at", null)
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: { type: "backend", message: error.message } }

  return {
    ok: true,
    data: (data ?? []).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
    })),
  }
}
