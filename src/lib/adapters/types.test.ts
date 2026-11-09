import { describe, expectTypeOf, it } from "vitest"
import type { Database } from "@/lib/supabase/database.types"
import type {
  Event,
  EventCreate,
  EventRepository,
  EventUpdate,
  Volunteer,
  VolunteerCreate,
  VolunteerRepository,
  VolunteerUpdate,
} from "./types"

// Type-level checks: `npm run typecheck` fails if a contract drifts from the schema.
describe("volunteer contracts", () => {
  it("are built from generated rows", () => {
    expectTypeOf<Volunteer>().not.toBeAny()
    expectTypeOf<Volunteer>().toEqualTypeOf<Database["public"]["Tables"]["volunteers"]["Row"]>()
    expectTypeOf<ReturnType<VolunteerRepository["getById"]>>().resolves.toEqualTypeOf<Volunteer | null>()
  })

  it("only accept columns the API lets users write", () => {
    expectTypeOf<VolunteerCreate>().toHaveProperty("user_id")
    expectTypeOf<VolunteerCreate>().not.toHaveProperty("status")
    expectTypeOf<VolunteerCreate>().not.toHaveProperty("organization_id")
    expectTypeOf<VolunteerUpdate>().not.toHaveProperty("user_id")
    expectTypeOf<VolunteerUpdate["availability_days"]>().toEqualTypeOf<("monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday")[] | undefined>()
  })
})

describe("event contracts", () => {
  it("are built from generated rows", () => {
    expectTypeOf<Event>().toEqualTypeOf<Database["public"]["Tables"]["events"]["Row"]>()
    expectTypeOf<ReturnType<EventRepository["getById"]>>().resolves.toEqualTypeOf<Event | null>()
  })

  it("only accept columns staff can write", () => {
    expectTypeOf<EventCreate>().toHaveProperty("organization_id")
    expectTypeOf<EventCreate>().not.toHaveProperty("id")
    expectTypeOf<EventUpdate>().not.toHaveProperty("organization_id")
    expectTypeOf<EventUpdate["status"]>().toEqualTypeOf<"draft" | "published" | "cancelled" | "completed" | undefined>()
  })
})
