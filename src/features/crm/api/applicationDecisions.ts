import { z } from "zod"

import { getUserRole } from "@/features/auth"
import type { Enums } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ApplicationDecision = "approved" | "rejected"

export type ApplicationDecisionError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "not-allowed" }
  | { type: "not-found" }
  | { type: "already-decided" }
  | { type: "not-latest" }
  | { type: "backend"; message: string }

export type ApplicationDecisionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApplicationDecisionError }

const decisionSchema = z.object({
  applicationId: z.guid(),
  decision: z.enum(["approved", "rejected"]),
  applicantMessage: z.string().max(2000).optional(),
})

// SQLSTATEs public.decide_application raises (see
// supabase/migrations/20261118014015_decide_application.sql):
// - 42501: the caller isn't staff in the application's organization, or it's
//   their own application.
// - 22023: the same decision was already made (e.g. by someone else a moment
//   ago), or the volunteer has applied again since this application.
const RLS_VIOLATION = "42501"
const INVALID_DECISION = "22023"
const NOT_LATEST_MESSAGE = "Only the latest application can be decided"

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Approves or rejects an application. Admins and managers can decide
 * applications in their organization, and can change a decision later
 * (e.g. undo a mistaken rejection). Making the same decision twice fails.
 *
 * The database records who decided and when, keeps the volunteer's status in
 * sync, fills in the organization's default message when a rejection has no
 * message, and clears the message on approval. This function only checks the
 * input and translates the outcome into a typed result.
 */
export async function approveOrRejectApplication(
  applicationId: string,
  decision: ApplicationDecision,
  applicantMessage?: string
): Promise<ApplicationDecisionResult<{ status: Enums<"volunteer_status"> }>> {
  const parsed = decisionSchema.safeParse({ applicationId, decision, applicantMessage })
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const role = await getUserRole(user)
  if (role !== "admin" && role !== "manager") {
    return { ok: false, error: { type: "not-allowed" } }
  }

  // Staff only see applications in their own organization.
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("status")
    .eq("id", parsed.data.applicationId)
    .maybeSingle()

  if (applicationError) {
    return { ok: false, error: { type: "backend", message: applicationError.message } }
  }
  if (!application) {
    return { ok: false, error: { type: "not-found" } }
  }
  if (application.status === parsed.data.decision) {
    return { ok: false, error: { type: "already-decided" } }
  }

  const { data, error } = await supabase.rpc("decide_application", {
    target_application_id: parsed.data.applicationId,
    decision: parsed.data.decision,
    message: parsed.data.decision === "rejected" ? parsed.data.applicantMessage : undefined,
  })

  if (error) {
    if (error.code === RLS_VIOLATION) {
      return { ok: false, error: { type: "not-allowed" } }
    }
    if (error.code === INVALID_DECISION) {
      return { ok: false, error: { type: error.message === NOT_LATEST_MESSAGE ? "not-latest" : "already-decided" } }
    }
    return { ok: false, error: { type: "backend", message: error.message } }
  }

  return { ok: true, data: { status: data.status } }
}
