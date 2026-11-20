import { z } from "zod"

// Blank optional text is stored as null, not "".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null)

const timestamp = z.iso.datetime({ offset: true })

/**
 * The event fields staff can set. Status is left out: lifecycle transitions
 * have their own rules (FOR-80), so new events start as drafts.
 */
export const eventFieldsSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: optionalText(5000),
  category: optionalText(100),
  location: optionalText(500),
  requirements: optionalText(2000),
  starts_at: timestamp,
  ends_at: timestamp,
  capacity: z.number().int().positive("Capacity must be at least 1").nullish().transform((v) => v ?? null),
  registration_deadline: timestamp.nullish().transform((v) => v ?? null),
})

export type EventFields = z.output<typeof eventFieldsSchema>

type EventDates = Pick<EventFields, "starts_at" | "ends_at" | "registration_deadline">

/**
 * The events table's date check constraints, reported per field. The
 * constraints stay the source of truth; this just names the field. Edits run
 * it on the stored dates merged with the changed ones.
 */
export function eventDateErrors(event: EventDates): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const startsAt = Date.parse(event.starts_at)
  if (Date.parse(event.ends_at) <= startsAt) {
    errors.ends_at = ["End must be after the start"]
  }
  if (event.registration_deadline && Date.parse(event.registration_deadline) > startsAt) {
    errors.registration_deadline = ["Registration deadline can't be after the start"]
  }
  return errors
}

export const eventSchema = eventFieldsSchema.superRefine((event, ctx) => {
  for (const [field, messages] of Object.entries(eventDateErrors(event))) {
    for (const message of messages) ctx.addIssue({ code: "custom", path: [field], message })
  }
})

/** An edit: any subset of fields. Omitted fields are left as they are; null clears one. */
export const eventUpdateSchema = eventFieldsSchema.partial()
