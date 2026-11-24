// Pure display helpers for the volunteer event screens; safe in client components.
import type { Event } from "@/lib/adapters/types"

/**
 * Event times are shown in one fixed zone so server and client render the
 * same text (no hydration mismatch). There's no per-organization timezone
 * column yet; the single organization is in Waterloo, ON.
 */
export const EVENT_TIME_ZONE = "America/Toronto"

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: EVENT_TIME_ZONE,
})

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: EVENT_TIME_ZONE,
})

const zoneFormat = new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone: EVENT_TIME_ZONE })

/** "Saturday, Oct 31" */
export function formatEventDay(event: Pick<Event, "starts_at">): string {
  return dayFormat.format(new Date(event.starts_at))
}

function zoneName(date: Date): string | undefined {
  return zoneFormat.formatToParts(date).find((part) => part.type === "timeZoneName")?.value
}

/** "6:00 PM – 8:00 PM EST", or "1:30 AM EDT – 1:30 AM EST" when a DST switch falls in between. */
export function formatEventTimeRange(event: Pick<Event, "starts_at" | "ends_at">): string {
  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)
  const startZone = zoneName(start)
  const endZone = zoneName(end)
  if (startZone !== endZone) {
    return `${timeFormat.format(start)} ${startZone ?? ""} – ${timeFormat.format(end)} ${endZone ?? ""}`.trim()
  }
  const range = `${timeFormat.format(start)} – ${timeFormat.format(end)}`
  return startZone ? `${range} ${startZone}` : range
}

/** Spots still open, or null when the event has no capacity limit. Never negative. */
export function spotsLeft(event: Pick<Event, "capacity" | "registration_count">): number | null {
  if (event.capacity == null) return null
  return Math.max(0, event.capacity - (event.registration_count ?? 0))
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/** True for a real YYYY-MM-DD date, like a date input sends. */
export function isCalendarDay(value: string): boolean {
  if (!CALENDAR_DAY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

// How far EVENT_TIME_ZONE's wall clock is ahead of UTC at `instant`.
function zoneOffsetMs(instant: number): number {
  const parts = offsetFormat.formatToParts(new Date(instant))
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const wallClock = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return wallClock - instant
}

/** The instant a YYYY-MM-DD day starts in EVENT_TIME_ZONE. */
function startOfDay(day: string): number {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`)
  return utcMidnight - zoneOffsetMs(utcMidnight)
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A "from"/"to" calendar-day pair (both inclusive, in EVENT_TIME_ZONE) as the
 * ISO bounds getOpportunities takes. Invalid days are ignored.
 */
export function dayRangeToBounds(from?: string, to?: string): { startsAfter?: string; startsBefore?: string } {
  const bounds: { startsAfter?: string; startsBefore?: string } = {}
  if (from && isCalendarDay(from)) bounds.startsAfter = new Date(startOfDay(from)).toISOString()
  if (to && isCalendarDay(to)) {
    const nextDay = new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
    bounds.startsBefore = new Date(startOfDay(nextDay) - 1).toISOString()
  }
  return bounds
}
