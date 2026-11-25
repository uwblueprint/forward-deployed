// Friendly copy for registration outcomes. Never show a backend message.
import type { Enums } from "@/lib/supabase/database.types"

import type { EventCancellationError, EventRegistrationError } from "../api/registrations"

export const GENERIC_ERROR = "Something went wrong. Please try again."

export const NOT_ELIGIBLE_NEUTRAL =
  "You can't register for this event right now. Refresh the page to see its latest status."

/** Why this volunteer can't register yet, or null if they're approved. */
export function ineligibleMessage(status: Enums<"volunteer_status"> | null): string | null {
  switch (status) {
    case "approved":
      return null
    case "pending":
      return "Your volunteer application is still under review. You can register for events once it's approved."
    case "rejected":
      return "Only approved volunteers can register for events."
    default:
      return "Finish your volunteer application to register for events."
  }
}

export function registrationErrorMessage(
  error: EventRegistrationError,
  volunteerStatus: Enums<"volunteer_status"> | null
): string {
  switch (error.type) {
    case "unauthenticated":
      return "Your session has expired. Sign in again to register."
    case "no-profile":
      return "Finish your volunteer application to register for events."
    case "event-not-found":
      return "This event is no longer available."
    case "already-registered":
      return "You're already registered for this event."
    case "full":
      return "Sorry, this event just filled up."
    case "not-eligible":
      // RLS refused without saying why (approval, event closed, ...). Only
      // name a cause we already know from the volunteer's status.
      return ineligibleMessage(volunteerStatus) ?? NOT_ELIGIBLE_NEUTRAL
    case "validation":
      return "Check your answers and try again."
    default:
      return GENERIC_ERROR
  }
}

export function cancellationErrorMessage(error: EventCancellationError): string {
  switch (error.type) {
    case "unauthenticated":
      return "Your session has expired. Sign in again to cancel."
    case "not-found":
      return "We couldn't find your registration. Refresh the page and try again."
    case "not-eligible":
      return "This registration can't be cancelled anymore."
    default:
      return GENERIC_ERROR
  }
}
