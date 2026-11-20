"use server"

import type { Event } from "@/lib/adapters"

import { getEventRegistrations, setAttendance } from "./eventRegistrations"
import type {
  AttendanceStatus,
  EventRegistration,
  EventRegistrationsFilter,
  EventRegistrationsResult,
} from "./eventRegistrations"
import { createEvent, updateEvent } from "./manageEvents"
import type { EventMutationResult } from "./manageEvents"
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

export async function createEventAction(input: unknown): Promise<EventMutationResult<Event>> {
  return createEvent(input)
}

export async function updateEventAction(id: string, input: unknown): Promise<EventMutationResult<Event>> {
  return updateEvent(id, input)
}

export async function getEventRegistrationsAction(
  eventId: string,
  filter: EventRegistrationsFilter = {}
): Promise<EventRegistrationsResult<EventRegistration[]>> {
  return getEventRegistrations(eventId, filter)
}

export async function setAttendanceAction(
  registrationId: string,
  attendance: AttendanceStatus
): Promise<EventRegistrationsResult<EventRegistration>> {
  return setAttendance(registrationId, attendance)
}
