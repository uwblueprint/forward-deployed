import { z } from "zod"

import { getUserRole } from "@/features/auth"
import type { Enums, Tables } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type VolunteerDetailsError =
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type VolunteerDetailsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VolunteerDetailsError }

export interface VolunteerLatestApplication {
  id: string
  status: Enums<"volunteer_status">
  applicantMessage: string | null
  submittedAt: string
  reviewedAt: string | null
}

export interface VolunteerEventHistoryItem {
  registrationId: string
  registrationStatus: Enums<"registration_status">
  attendance: "attended" | "no_show" | null
  event: Pick<Tables<"events">, "id" | "title" | "starts_at" | "ends_at" | "status">
}

export interface VolunteerDetails {
  volunteer: Tables<"volunteers">
  /** Null only if RLS hides the user row. */
  user: Pick<Tables<"users">, "id" | "first_name" | "last_name" | "email"> | null
  latestApplication: VolunteerLatestApplication | null
  /** Every registration, latest event first. */
  events: VolunteerEventHistoryItem[]
  eventsAttended: number
  /** Event length summed over registrations that are still registered and marked attended. */
  hours: number
  /** The organization's skill list, to pick from when editing. */
  skillOptions: string[]
}

const STAFF_ROLES = ["admin", "manager"]
const HOUR_MS = 60 * 60 * 1000

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function settingsSkills(settings: unknown): string[] {
  return typeof settings === "object" && settings !== null && !Array.isArray(settings)
    ? textList((settings as Record<string, unknown>).skills)
    : []
}

function attendance(value: string | null): VolunteerEventHistoryItem["attendance"] {
  return value === "attended" || value === "no_show" ? value : null
}

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Staff-only (admin and manager). One volunteer in the caller's
 * organization with their name, latest application, and event history.
 * Hours aren't stored: they're each attended event's length (see
 * docs/role-model.md). RLS scopes every read to the caller's organization,
 * so a volunteer elsewhere reads as not found.
 */
export async function getVolunteerDetails(
  volunteerId: string
): Promise<VolunteerDetailsResult<VolunteerDetails>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: { type: "unauthenticated" } }

  const role = await getUserRole(user)
  if (!role || !STAFF_ROLES.includes(role)) return { ok: false, error: { type: "forbidden" } }

  // guid, not uuid: Postgres accepts ids that aren't RFC 4122 variants.
  if (!z.guid().safeParse(volunteerId).success) return { ok: false, error: { type: "not-found" } }

  const { data: row, error: volunteerError } = await supabase
    .from("volunteers")
    .select("*, user:users(id, first_name, last_name, email)")
    .eq("id", volunteerId)
    .maybeSingle()
  if (volunteerError) return { ok: false, error: { type: "backend", message: volunteerError.message } }
  if (!row) return { ok: false, error: { type: "not-found" } }

  const { user: volunteerUser, ...volunteer } = row

  const [applicationResult, registrationsResult, organizationResult] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, applicant_message, submitted_at, reviewed_at")
      .eq("volunteer_id", volunteerId)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("registrations")
      .select("id, status, attendance_status, event:events(id, title, starts_at, ends_at, status)")
      .eq("volunteer_id", volunteerId),
    volunteer.organization_id
      ? supabase.from("organizations").select("settings").eq("id", volunteer.organization_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const failed = applicationResult.error ?? registrationsResult.error ?? organizationResult.error
  if (failed) return { ok: false, error: { type: "backend", message: failed.message } }

  const application = applicationResult.data
  const events: VolunteerEventHistoryItem[] = (registrationsResult.data ?? [])
    .flatMap((registration) =>
      registration.event
        ? [
            {
              registrationId: registration.id,
              registrationStatus: registration.status,
              attendance: attendance(registration.attendance_status),
              event: registration.event,
            },
          ]
        : []
    )
    // Compared as times: the same instant can be written with different offsets.
    .sort((a, b) => Date.parse(b.event.starts_at) - Date.parse(a.event.starts_at))

  // Only a signup that is still registered and was marked attended counts.
  // The database refuses attendance on a cancelled signup; this says so here too.
  const attended = events.filter((item) => item.registrationStatus === "registered" && item.attendance === "attended")
  const hours = attended.reduce(
    (total, item) => total + (Date.parse(item.event.ends_at) - Date.parse(item.event.starts_at)) / HOUR_MS,
    0
  )

  return {
    ok: true,
    data: {
      volunteer,
      user: volunteerUser,
      latestApplication: application
        ? {
            id: application.id,
            status: application.status,
            applicantMessage: application.applicant_message,
            submittedAt: application.submitted_at,
            reviewedAt: application.reviewed_at,
          }
        : null,
      events,
      eventsAttended: attended.length,
      hours,
      skillOptions: settingsSkills(organizationResult.data?.settings),
    },
  }
}
