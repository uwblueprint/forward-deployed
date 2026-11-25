import { getUserRole } from "@/features/auth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type DashboardCountsError =
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "backend"; message: string }

export type DashboardCountsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DashboardCountsError }

export interface DashboardCounts {
  totalVolunteers: number
  pendingApplications: number
  upcomingEvents: number
  nearFullEvents: number
}

// An upcoming event is "near full" once this many spots or fewer remain,
// including already-full or over-capacity events.
const NEAR_FULL_THRESHOLD = 2

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Staff-only (admin and manager). RLS scopes every table to the caller's
 * organization, same as the rest of the query layer - see events.ts's doc
 * comment. No page reads this yet (FOR-108 is backend-only).
 */
export async function getDashboardCounts(): Promise<DashboardCountsResult<DashboardCounts>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const role = await getUserRole(user)
  if (role !== "admin" && role !== "manager") return { ok: false, error: { type: "forbidden" } }

  const nowIso = new Date().toISOString()

  const [volunteers, applications, events] = await Promise.all([
    supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("events")
      .select("capacity, registration_count")
      .eq("status", "published")
      .gt("starts_at", nowIso),
  ])

  const failed = volunteers.error ?? applications.error ?? events.error
  if (failed) return { ok: false, error: { type: "backend", message: failed.message } }

  const upcomingEvents = events.data ?? []
  const nearFullEvents = upcomingEvents.filter(
    (event) => event.capacity !== null && event.capacity - (event.registration_count ?? 0) <= NEAR_FULL_THRESHOLD
  ).length

  return {
    ok: true,
    data: {
      totalVolunteers: volunteers.count ?? 0,
      pendingApplications: applications.count ?? 0,
      upcomingEvents: upcomingEvents.length,
      nearFullEvents,
    },
  }
}
