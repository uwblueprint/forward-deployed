// Pure event-state rules with no server imports, so client components can use
// them too (e.g. to decide which status actions to offer).
import type { Event } from "@/lib/adapters/types"
import type { Enums } from "@/lib/supabase/database.types"

export type EventStatus = Enums<"event_status">

/**
 * State derived from the stored status and the clock - never stored (see
 * docs/role-model.md). `phase` is where the event is in time; `registration`
 * is whether a volunteer could sign up right now. A published event whose end
 * has passed is "ended" until staff mark it completed.
 */
export interface DerivedEventState {
  phase: "upcoming" | "in-progress" | "ended"
  registration: "open" | "closed" | "full" | "unavailable"
}

export function deriveEventState(event: Event, now: number = Date.now()): DerivedEventState {
  const startsAt = new Date(event.starts_at).getTime()
  const endsAt = new Date(event.ends_at).getTime()
  const phase = now < startsAt ? "upcoming" : now < endsAt ? "in-progress" : "ended"

  let registration: DerivedEventState["registration"]
  if (event.status !== "published") registration = "unavailable"
  else if (now >= startsAt) registration = "closed"
  else if (event.registration_deadline && new Date(event.registration_deadline).getTime() <= now) registration = "closed"
  else if (event.capacity != null && (event.registration_count ?? 0) >= event.capacity) registration = "full"
  else registration = "open"

  return { phase, registration }
}

/**
 * The legal status changes (pending product sign-off). Cancelled and completed
 * are final; the database also refuses to reopen a completed event.
 */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["draft", "cancelled", "completed"],
  cancelled: [],
  completed: [],
}

/**
 * Why `event` can't move to `to` right now, or null if it can. Pure, so a UI
 * can use it to decide which actions to offer.
 */
export function transitionBlocker(event: Event, to: EventStatus, now: number = Date.now()): string | null {
  const from = event.status
  if (!EVENT_TRANSITIONS[from].includes(to)) {
    return EVENT_TRANSITIONS[from].length === 0
      ? `A ${from} event can't change status`
      : `A ${from} event can't be moved to ${to}`
  }
  const startsAt = new Date(event.starts_at).getTime()
  if (to === "published" && startsAt <= now) return "An event that has already started can't be published"
  if (to === "completed" && startsAt > now) return "An event can't be completed before it starts"
  if (to === "draft" && (event.registration_count ?? 0) > 0) {
    return "An event with registrations can't go back to draft; cancel it instead"
  }
  return null
}
