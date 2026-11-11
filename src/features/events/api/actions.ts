"use server"

import type { Event } from "@/lib/adapters/types"

import { getMyEvents, getOpportunities } from "./events"
import type { EventQueryResult, MyEvents, MyEventsResult, OpportunityFilters } from "./events"
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
