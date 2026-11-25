"use server"

import { approveOrRejectApplication, editApplicantMessage } from "./applicationDecisions"
import { saveApplicationNote } from "./applicationNotes"
import type { ApplicationNoteResult } from "./applicationNotes"
import type {
  ApplicantMessageResult,
  ApplicationDecision,
  ApplicationDecisionOptions,
  ApplicationDecisionResult,
} from "./applicationDecisions"

/** Server Action wrappers so the review screen's Client Components can call these. */
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

export async function saveApplicationNoteAction(applicationId: string, note: string): Promise<ApplicationNoteResult> {
  return saveApplicationNote(applicationId, note)
}
