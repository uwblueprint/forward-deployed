"use server"

import { getEventRegistrations } from "./eventRegistrations"
import type { EventRegistration, EventRegistrationsFilter, EventRegistrationsResult } from "./eventRegistrations"
import { cancelRegistration, registerForEvent } from "./registrations"
import type { EventCancellationResult, EventRegistrationResult } from "./registrations"

/**
 * Server Action wrappers so a Client Component can call these directly. Not
 * wired into any component yet - see registrations.ts's doc comment.
 */
export async function registerForEventAction(
  eventId: string,
  responses: unknown = {}
): Promise<EventRegistrationResult<{ id: string }>> {
  return registerForEvent(eventId, responses)
}

export async function cancelRegistrationAction(
  registrationId: string
): Promise<EventCancellationResult<{ id: string }>> {
  return cancelRegistration(registrationId)
}

export async function getEventRegistrationsAction(
  eventId: string,
  filter: EventRegistrationsFilter = {}
): Promise<EventRegistrationsResult<EventRegistration[]>> {
  return getEventRegistrations(eventId, filter)
}
