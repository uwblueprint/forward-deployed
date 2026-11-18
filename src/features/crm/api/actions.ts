"use server"

import { approveOrRejectApplication } from "./applicationDecisions"
import type { ApplicationDecision, ApplicationDecisionOptions, ApplicationDecisionResult } from "./applicationDecisions"

/**
 * Server Action wrapper so a Client Component can call this directly. Not
 * wired into the review screen yet.
 */
export async function approveOrRejectApplicationAction(
  applicationId: string,
  decision: ApplicationDecision,
  applicantMessage?: string,
  options?: ApplicationDecisionOptions
): Promise<ApplicationDecisionResult> {
  return approveOrRejectApplication(applicationId, decision, applicantMessage, options)
}
