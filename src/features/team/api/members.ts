import type { TeamMember } from "../types"
import { adminSession, type TeamResult } from "./session"

function compareNullableNames(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b, undefined, { sensitivity: "base" })
}

/** Last name, then first name, case-insensitively; no name sorts last. */
function byName(a: TeamMember, b: TeamMember): number {
  const byLastName = compareNullableNames(a.lastName, b.lastName)
  return byLastName !== 0 ? byLastName : compareNullableNames(a.firstName, b.firstName)
}

/**
 * Plain server-side function - not a Server Action. Call from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * Every member of the caller's organization, with their role. RLS scopes
 * rows to the caller's organization; adminSession() further restricts the
 * caller to admins, since the Team page is admin-only.
 */
export async function listMembers(): Promise<TeamResult<TeamMember[]>> {
  const session = await adminSession()
  if (!session.ok) return session

  const { data, error } = await session.supabase
    .from("memberships")
    .select("role, user:users(id, first_name, last_name, email)")

  if (error) return { ok: false, error: { type: "backend", message: error.message } }

  return {
    ok: true,
    data: (data ?? [])
      .filter((membership) => membership.user !== null)
      .map((membership) => ({
        id: membership.user!.id,
        firstName: membership.user!.first_name,
        lastName: membership.user!.last_name,
        email: membership.user!.email,
        role: membership.role,
        isCurrentUser: membership.user!.id === session.userId,
      }))
      .sort(byName),
  }
}
