import { z } from "zod"

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

export type ApplicationDecisionResult =
  | { ok: true; data: { status: ApplicationDecision } }
  | { ok: false; error: ApplicationDecisionError }

export interface ApplicationDecisionOptions {
  /** The status the reviewer saw. Pass the current decision to change it. */
  expectedStatus?: Enums<"volunteer_status">
}

const decisionSchema = z.object({
  applicationId: z.guid(),
  decision: z.enum(["approved", "rejected"]),
  applicantMessage: z.string().max(2000).optional(),
  expectedStatus: z.enum(["pending", "approved", "rejected"]),
})

// SQLSTATEs public.decide_application raises (see
// supabase/migrations/20261118014015_decide_application.sql).
const ERROR_TYPES: Partial<Record<string, "not-allowed" | "not-found" | "not-latest" | "already-decided">> = {
  "42501": "not-allowed", // not staff in that organization, or their own application
  P0002: "not-found", // no such application in the caller's organization
  "55000": "not-latest", // the volunteer has applied again since
  "22023": "already-decided", // repeated, or someone changed it since the reviewer looked
}

/**
 * Plain server-side function - not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Approves or rejects an application. Admins and managers decide
 * applications in their organization. A decision only applies if the
 * application still has the status the reviewer saw, which is pending unless
 * `expectedStatus` says otherwise, so nobody overturns a decision they
 * haven't seen. To fix a mistake, pass the current status, e.g.
 * `approveOrRejectApplication(id, "approved", undefined, { expectedStatus: "rejected" })`.
 *
 * The database checks permissions, records who decided and when, keeps the
 * volunteer's status in sync, fills in the organization's default message
 * when a rejection has none, and clears the message on approval. This
 * function checks the input and translates the outcome into a typed result.
 */
export async function approveOrRejectApplication(
  applicationId: string,
  decision: ApplicationDecision,
  applicantMessage?: string,
  options?: ApplicationDecisionOptions
): Promise<ApplicationDecisionResult> {
  const parsed = decisionSchema.safeParse({
    applicationId,
    decision,
    // Approval clears the message, so a leftover one is ignored.
    applicantMessage: decision === "rejected" ? applicantMessage : undefined,
    expectedStatus: options?.expectedStatus ?? "pending",
  })
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

  const { error } = await supabase.rpc("decide_application", {
    target_application_id: parsed.data.applicationId,
    decision: parsed.data.decision,
    message: parsed.data.applicantMessage,
    expected_status: parsed.data.expectedStatus,
  })

  if (error) {
    const type = ERROR_TYPES[error.code]
    return { ok: false, error: type ? { type } : { type: "backend", message: error.message } }
  }

  return { ok: true, data: { status: parsed.data.decision } }
}

export type ApplicantMessageError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "not-allowed" }
  | { type: "not-found" }
  | { type: "not-rejected" }
  | { type: "backend"; message: string }

export type ApplicantMessageResult =
  | { ok: true; data: { applicantMessage: string | null } }
  | { ok: false; error: ApplicantMessageError }

const messageSchema = z.object({
  applicationId: z.guid(),
  applicantMessage: z.string().max(2000),
})

// SQLSTATEs public.edit_applicant_message raises (same migration).
const MESSAGE_ERROR_TYPES: Partial<Record<string, "not-allowed" | "not-found" | "not-rejected">> = {
  "42501": "not-allowed",
  P0002: "not-found",
  "22023": "not-rejected",
}

/**
 * Fixes the message on a rejected application without deciding it again.
 * Same rules as approveOrRejectApplication for who can do it. A blank message
 * uses the organization's default; the saved message is returned.
 */
export async function editApplicantMessage(
  applicationId: string,
  applicantMessage: string
): Promise<ApplicantMessageResult> {
  const parsed = messageSchema.safeParse({ applicationId, applicantMessage })
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

  const { data, error } = await supabase.rpc("edit_applicant_message", {
    target_application_id: parsed.data.applicationId,
    message: parsed.data.applicantMessage,
  })

  if (error) {
    const type = MESSAGE_ERROR_TYPES[error.code]
    return { ok: false, error: type ? { type } : { type: "backend", message: error.message } }
  }

  return { ok: true, data: { applicantMessage: data.applicant_message } }
}
