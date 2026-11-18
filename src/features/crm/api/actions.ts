"use server"

import { approveOrRejectApplication } from "./applicationDecisions"
import type { ApplicationDecision, ApplicationDecisionResult } from "./applicationDecisions"
import type { Enums } from "@/lib/supabase/database.types"

/**
 * Server Action wrapper so a Client Component can call this directly. Not
 * wired into the review screen yet.
 */
export async function approveOrRejectApplicationAction(
  applicationId: string,
  decision: ApplicationDecision,
  applicantMessage?: string
): Promise<ApplicationDecisionResult<{ status: Enums<"volunteer_status"> }>> {
  return approveOrRejectApplication(applicationId, decision, applicantMessage)
}
