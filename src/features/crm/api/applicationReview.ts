import { z } from "zod"

import { getUserRole } from "@/features/auth"
import type { VolunteerWithUser } from "@/lib/adapters"
import type { Enums, Json, Tables } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type ApplicationStatus = Enums<"volunteer_status">
type Person = Pick<Tables<"users">, "first_name" | "last_name" | "email">

export type ApplicationReviewError =
  | { type: "unauthenticated" }
  | { type: "forbidden" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type ApplicationReviewResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApplicationReviewError }

/** One row of the review queue: a volunteer's latest application. */
export interface ApplicationSummary {
  id: string
  status: ApplicationStatus
  submittedAt: string
  reviewedAt: string | null
  volunteerId: string
  /** Null only if RLS hides the user row. */
  applicant: Person | null
}

export interface ApplicationAnswer {
  questionId: string
  question: string
  fieldType: string
  /** Null when the question was left blank. */
  answer: Json | null
}

export interface PastApplication {
  id: string
  status: ApplicationStatus
  submittedAt: string
  applicantMessage: string | null
}

export interface ApplicationReview {
  id: string
  status: ApplicationStatus
  submittedAt: string
  reviewedAt: string | null
  reviewer: Pick<Tables<"users">, "first_name" | "last_name"> | null
  applicantMessage: string | null
  /** The caller's own application. Nobody reviews or annotates their own. */
  isOwn: boolean
  /** Only the latest application can be decided. */
  isLatest: boolean
  /** The volunteer's latest application, when this one isn't it. */
  latestApplicationId: string | null
  answers: ApplicationAnswer[]
  /** The caller can read and write internal notes (admins only, never on their own application). */
  canManageNote: boolean
  /** Always null for managers. */
  note: string | null
  volunteer: VolunteerWithUser
  /** The volunteer's other applications, newest first. */
  otherApplications: PastApplication[]
}

const STAFF_ROLES = ["admin", "manager"]
const PAGE_SIZE = 1000

const REVIEW_COLUMNS =
  "id, status, submitted_at, reviewed_at, applicant_message, questions, responses, volunteer_id, reviewer:users!applications_reviewed_by_fkey(first_name, last_name), volunteer:volunteers(*, user:users(first_name, last_name, email))"

// Same order as private.sync_volunteer_status: latest by submitted_at, then id.
function newestFirst<T extends { submitted_at: string; id: string }>(a: T, b: T) {
  const byTime = Date.parse(b.submitted_at) - Date.parse(a.submitted_at)
  if (byTime !== 0) return byTime
  return a.id < b.id ? 1 : -1
}

const STATUS_ORDER: Record<ApplicationStatus, number> = { pending: 0, rejected: 1, approved: 1 }

async function staffSession() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: { type: "unauthenticated" as const } }

  const role = await getUserRole(user)
  if (!role || !STAFF_ROLES.includes(role)) return { ok: false as const, error: { type: "forbidden" as const } }

  return { ok: true as const, supabase, role, userId: user.id }
}

/**
 * Plain server-side functions - not Server Actions. Call them from a Server
 * Component, Server Action, or Route Handler; do not add "use server" here.
 *
 * The review queue for admins and managers: each volunteer's latest
 * application, pending first (oldest first, so nobody waits longest), then
 * decided ones, most recently submitted first. Older applications from the
 * same volunteer are on the detail page. RLS scopes rows to the caller's
 * organization.
 */
export async function listApplications(): Promise<ApplicationReviewResult<ApplicationSummary[]>> {
  const session = await staffSession()
  if (!session.ok) return session

  // The API returns at most a page of rows per request (max_rows in
  // supabase/config.toml), so read every page; stopping at the first would
  // silently drop the oldest applications, the ones waiting longest.
  const page = (from: number) =>
    session.supabase
      .from("applications")
      .select("id, status, submitted_at, reviewed_at, volunteer_id, volunteer:volunteers(user:users(first_name, last_name, email))")
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

  const data: NonNullable<Awaited<ReturnType<typeof page>>["data"]> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rows, error } = await page(from)
    if (error) return { ok: false, error: { type: "backend", message: error.message } }
    data.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }

  const latest = new Map<string, (typeof data)[number]>()
  for (const row of [...data].sort(newestFirst)) {
    if (!latest.has(row.volunteer_id)) latest.set(row.volunteer_id, row)
  }

  const summaries = [...latest.values()].map((row) => ({
    id: row.id,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    volunteerId: row.volunteer_id,
    applicant: row.volunteer?.user ?? null,
  }))

  summaries.sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (byStatus !== 0) return byStatus
    // Compared as times: the same instant can be written with different offsets or precision.
    const byTime = Date.parse(a.submittedAt) - Date.parse(b.submittedAt)
    return a.status === "pending" ? byTime : -byTime
  })

  return { ok: true, data: summaries }
}

type QuestionSnapshot = { id: string; field_name: string; field_type: string }

function asQuestions(value: Json): QuestionSnapshot[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (q): q is QuestionSnapshot =>
      typeof q === "object" &&
      q !== null &&
      !Array.isArray(q) &&
      typeof q.id === "string" &&
      typeof q.field_name === "string" &&
      typeof q.field_type === "string"
  )
}

/**
 * One application with everything a reviewer needs: the volunteer's
 * profile, their answers labelled with the questions as they were asked,
 * their other applications, and, for admins only, the internal note.
 * Another organization's application reads as not found.
 */
export async function getApplicationReview(
  applicationId: string
): Promise<ApplicationReviewResult<ApplicationReview>> {
  const session = await staffSession()
  if (!session.ok) return session
  const { supabase, role, userId } = session

  // guid, not uuid: Postgres accepts ids that aren't RFC 4122 variants.
  if (!z.guid().safeParse(applicationId).success) return { ok: false, error: { type: "not-found" } }

  const { data: application, error } = await supabase
    .from("applications")
    .select(REVIEW_COLUMNS)
    .eq("id", applicationId)
    .maybeSingle()

  if (error) return { ok: false, error: { type: "backend", message: error.message } }
  if (!application || !application.volunteer) return { ok: false, error: { type: "not-found" } }

  const isOwn = application.volunteer.user_id === userId
  const canManageNote = role === "admin" && !isOwn

  const responses: Record<string, Json | undefined> =
    typeof application.responses === "object" && application.responses !== null && !Array.isArray(application.responses)
      ? application.responses
      : {}
  const snapshot = asQuestions(application.questions)
  const answeredIds = Object.keys(responses).filter((key) => z.guid().safeParse(key).success)

  const [siblings, questions, note] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, submitted_at, applicant_message")
      .eq("volunteer_id", application.volunteer_id),
    // An application with no snapshot was either asked nothing or saved before
    // snapshots existed. Only the second kind has answers, so the current
    // questions are looked up just to label those.
    snapshot.length > 0 || answeredIds.length === 0
      ? Promise.resolve({ data: snapshot, error: null })
      : supabase
          .from("custom_fields")
          .select("id, field_name, field_type")
          .in("id", answeredIds)
          .eq("entity_type", "application")
          .order("position")
          .order("id"),
    canManageNote
      ? supabase.from("application_notes").select("internal_note").eq("application_id", application.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const failed = siblings.error ?? questions.error ?? note.error
  if (failed) return { ok: false, error: { type: "backend", message: failed.message } }

  const ordered = [...(siblings.data ?? [])].sort(newestFirst)
  const latestId = ordered[0]?.id ?? application.id

  return {
    ok: true,
    data: {
      id: application.id,
      status: application.status,
      submittedAt: application.submitted_at,
      reviewedAt: application.reviewed_at,
      reviewer: application.reviewer,
      applicantMessage: application.applicant_message,
      isOwn,
      isLatest: latestId === application.id,
      latestApplicationId: latestId === application.id ? null : latestId,
      answers: (questions.data ?? []).map((q) => ({
        questionId: q.id,
        question: q.field_name,
        fieldType: q.field_type,
        answer: responses[q.id] ?? null,
      })),
      canManageNote,
      note: note.data?.internal_note ?? null,
      volunteer: application.volunteer,
      otherApplications: ordered
        .filter((a) => a.id !== application.id)
        .map((a) => ({
          id: a.id,
          status: a.status,
          submittedAt: a.submitted_at,
          applicantMessage: a.applicant_message,
        })),
    },
  }
}
