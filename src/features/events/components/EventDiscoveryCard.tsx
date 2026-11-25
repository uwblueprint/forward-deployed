import Link from "next/link"
import { CalendarDaysIcon, MapPinIcon } from "lucide-react"
import { cn } from "cn"

import type { Event } from "@/lib/adapters/types"

import { deriveEventState } from "../utils/eventState"
import { formatEventDay, formatEventTimeRange } from "../utils/formatEvent"
import { EventStatusChip, eventChip } from "./EventStatusChip"

interface EventDiscoveryCardProps {
  event: Event
  /** False for a pending/rejected volunteer or one with no profile: they can browse but not register. */
  eligible: boolean
  now: number
}

/** Figma "Event-discovery-card". Links to /events/[id], which opens as a modal over the list. */
export function EventDiscoveryCard({ event, eligible, now }: EventDiscoveryCardProps) {
  const { registration } = deriveEventState(event, now)
  const chip = eventChip(event, registration, { eligible })
  const dimmed = registration !== "open"

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(
        "group flex gap-4 rounded-xl border bg-card p-3 text-card-foreground transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
        dimmed && "bg-muted/40"
      )}
    >
      {/* Events have no image yet; a neutral tile holds the Figma image slot. */}
      <div
        aria-hidden
        className="hidden size-24 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex"
      >
        <CalendarDaysIcon className="size-8" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-caption-md text-muted-foreground">
          <span className="text-foreground">{formatEventDay(event)}</span> {formatEventTimeRange(event)}
        </p>
        <h3 className={cn("truncate text-header-sm", dimmed && "text-muted-foreground")}>{event.title}</h3>
        <p className="flex min-w-0 items-center gap-2 rounded-lg bg-muted px-2 text-caption-md text-muted-foreground">
          <MapPinIcon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{event.location ?? "Location to be announced"}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          {event.category ? (
            <span className="text-caption-sm text-muted-foreground">{event.category}</span>
          ) : (
            <span />
          )}
          <EventStatusChip chip={chip} />
        </div>
      </div>
    </Link>
  )
}
