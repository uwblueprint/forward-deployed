"use server"

import { approveOrRejectApplication, editApplicantMessage } from "./applicationDecisions"
import type {
  ApplicantMessageResult,
  ApplicationDecision,
  ApplicationDecisionOptions,
  ApplicationDecisionResult,
} from "./applicationDecisions"

/**
 * Server Action wrappers so a Client Component can call these directly. Not
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

export async function editApplicantMessageAction(
  applicationId: string,
  applicantMessage: string
): Promise<ApplicantMessageResult> {
  return editApplicantMessage(applicationId, applicantMessage)
}
