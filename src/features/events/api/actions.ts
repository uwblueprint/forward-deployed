"use server"

import type { Event } from "@/lib/adapters"

import type { EventStatus } from "../utils/eventState"
import { changeEventStatus } from "./eventLifecycle"
import type { EventTransitionResult } from "./eventLifecycle"
import { getEventRegistrations } from "./eventRegistrations"
import type { EventRegistration, EventRegistrationsFilter, EventRegistrationsResult } from "./eventRegistrations"
import { getEvents, getMyEvents, getOpportunities } from "./events"
import type { EventQueryResult, MyEvents, MyEventsResult, OpportunityFilters, StaffEventFilters } from "./events"
import { createEvent, updateEvent } from "./manageEvents"
import type { EventMutationResult } from "./manageEvents"
import { cancelRegistration, registerForEvent } from "./registrations"
import type { EventCancellationResult, EventRegistrationResult } from "./registrations"

/**
 * Server Action wrappers so a Client Component can call these directly. Not
 * wired into any component yet - see registrations.ts's/events.ts's doc
 * comments.
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
