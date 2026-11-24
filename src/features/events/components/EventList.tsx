import type { Event } from "@/lib/adapters/types"
import type { Enums } from "@/lib/supabase/database.types"

import { InfoIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

import { EventDiscoveryCard } from "./EventDiscoveryCard"
import { EventsEmptyState } from "./EventsTemporaryStates"
import { ineligibleMessage } from "./registrationMessages"

interface EventListProps {
  events: Event[]
  volunteerStatus: Enums<"volunteer_status"> | null
  /** Whether any filter is applied, for the empty-state copy. */
  filtered: boolean
  now: number
}

/** The discovery grid of published events. */
export function EventList({ events, volunteerStatus, filtered, now }: EventListProps) {
  const blockedReason = ineligibleMessage(volunteerStatus)

  return (
    <div className="flex flex-col gap-4">
      {blockedReason && (
        <Alert className="border-info-border bg-info-muted text-info">
          <InfoIcon aria-hidden />
          <AlertDescription className="text-current">{blockedReason}</AlertDescription>
        </Alert>
      )}
      {events.length === 0 ? (
        <EventsEmptyState filtered={filtered} />
      ) : (
        <ul aria-label="Events" className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventDiscoveryCard event={event} eligible={!blockedReason} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
