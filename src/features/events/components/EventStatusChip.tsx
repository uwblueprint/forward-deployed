import { BanIcon, CheckIcon, ClockIcon, UsersIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import type { Event } from "@/lib/adapters/types"

import type { DerivedEventState } from "../utils/eventState"
import { spotsLeft } from "../utils/formatEvent"

type Tone = "info" | "danger" | "success" | "muted"

const TONES: Record<Tone, string> = {
  info: "bg-info-muted text-info",
  danger: "bg-destructive-muted text-destructive",
  success: "bg-success-muted text-success",
  muted: "bg-muted text-muted-foreground",
}

export interface EventChip {
  label: string
  tone: Tone
  icon: "users" | "x" | "check" | "clock" | "ban"
}

const ICONS = { users: UsersIcon, x: XIcon, check: CheckIcon, clock: ClockIcon, ban: BanIcon }

function spotsLabel(spots: number | null, suffix: string) {
  if (spots == null) return "Open"
  return `${spots} ${spots === 1 ? "spot" : "spots"}${suffix}`
}

/**
 * The one chip a volunteer sees for an event, by precedence: a cancelled or
 * completed event, then their own registration, then whether registration is possible at all, then whether
 * they're allowed to register, then spots left.
 */
export function eventChip(
  event: Pick<Event, "status" | "capacity" | "registration_count">,
  registration: DerivedEventState["registration"],
  options: { eligible: boolean; registered?: boolean; spotsSuffix?: string }
): EventChip {
  if (event.status === "cancelled") return { label: "Cancelled", tone: "muted", icon: "ban" }
  if (event.status === "completed") return { label: "Completed", tone: "muted", icon: "check" }
  if (options.registered) return { label: "Registered", tone: "success", icon: "check" }
  if (registration === "unavailable") return { label: "Unavailable", tone: "muted", icon: "ban" }
  if (registration === "closed") return { label: "Registration closed", tone: "muted", icon: "clock" }
  if (registration === "full") return { label: "Full", tone: "muted", icon: "users" }
  if (!options.eligible) return { label: "Not eligible", tone: "danger", icon: "x" }
  return { label: spotsLabel(spotsLeft(event), options.spotsSuffix ?? ""), tone: "info", icon: "users" }
}

export function EventStatusChip({ chip, className }: { chip: EventChip; className?: string }) {
  const Icon = ICONS[chip.icon]
  return (
    <Badge className={cn("h-6 rounded-full px-2.5 text-caption-sm", TONES[chip.tone], className)}>
      <Icon aria-hidden data-icon="inline-start" />
      {chip.label}
    </Badge>
  )
}
