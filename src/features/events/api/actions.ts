"use server"

import type { Event, VolunteerStatus } from "@/lib/adapters"

import type { EventStatus } from "../utils/eventState"
import { getEventDetails, getMyVolunteerStatus } from "./eventDetails"
import type { EventDetails, EventDetailsResult, VolunteerStatusResult } from "./eventDetails"
import { changeEventStatus } from "./eventLifecycle"
import type { EventTransitionResult } from "./eventLifecycle"
import { getEventRegistrations, setAttendance } from "./eventRegistrations"
import type {
  AttendanceStatus,
  EventRegistration,
  EventRegistrationsFilter,
  EventRegistrationsResult,
} from "./eventRegistrations"
import { getEvents, getMyEvents, getOpportunities } from "./events"
import type { EventQueryResult, MyEvents, MyEventsResult, OpportunityFilters, StaffEventFilters } from "./events"
import { createEvent, updateEvent } from "./manageEvents"
import type { EventMutationResult } from "./manageEvents"
import { cancelRegistration, registerForEvent } from "./registrations"
import type { EventCancellationResult, EventRegistrationResult } from "./registrations"

/**
 * Server Action wrappers so a Client Component can call these directly. The
 * volunteer event screens (src/app/(volunteer)/events) use the opportunity,
 * event-details, volunteer-status, register, and cancel actions.
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

export async function getOpportunitiesAction(
  filters: OpportunityFilters = {}
): Promise<EventQueryResult<Event[]>> {
  return getOpportunities(filters)
}

export async function getEventDetailsAction(eventId: string): Promise<EventDetailsResult<EventDetails>> {
  return getEventDetails(eventId)
}

export async function getMyVolunteerStatusAction(): Promise<VolunteerStatusResult<VolunteerStatus | null>> {
  return getMyVolunteerStatus()
}

export async function getMyEventsAction(): Promise<MyEventsResult<MyEvents>> {
  return getMyEvents()
}

export async function getEventsAction(filters: StaffEventFilters = {}): Promise<EventQueryResult<Event[]>> {
  return getEvents(filters)
}

export async function changeEventStatusAction(
  eventId: string,
  status: EventStatus
): Promise<EventTransitionResult<Event>> {
  return changeEventStatus(eventId, status)
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
