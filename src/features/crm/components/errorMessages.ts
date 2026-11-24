import type { ApplicantMessageError, ApplicationDecisionError } from "../api/applicationDecisions"
import type { ApplicationNoteError } from "../api/applicationNotes"

type AnyError = ApplicationDecisionError | ApplicantMessageError | ApplicationNoteError

/** Plain-language text for a failed review action. */
export function reviewErrorMessage(error: AnyError): string {
  switch (error.type) {
    case "validation":
      return Object.values(error.fieldErrors).flat()[0] ?? "Check the form and try again."
    case "unauthenticated":
      return "Your session ended. Sign in again to continue."
    case "not-allowed":
      return "You don't have permission to do that."
    case "not-found":
      return "This application no longer exists."
    case "already-decided":
      return "Someone else changed this application. Refresh to see its current status."
    case "not-latest":
      return "This volunteer has applied again. Review their latest application instead."
    case "not-rejected":
      return "Only a rejected application has a message."
    case "backend":
      return "Something went wrong. Try again."
  }
}
