/** Domain types and contracts on top of the generated database.types.ts (`npm run db:types`). */
import type { Enums, Tables, TablesInsert } from "@/lib/supabase/database.types"

export type AppRole = Enums<"app_role">
export type VolunteerStatus = Enums<"volunteer_status">
export type Weekday = Enums<"weekday">
export type Shift = Enums<"shift">

export type Membership = Pick<Tables<"memberships">, "organization_id" | "role">

/** A user row with their organization membership, or null before they join one. */
export type User = Tables<"users"> & { membership: Membership | null }

export type Volunteer = Tables<"volunteers">
/** An event row, plus registration_count (spots taken), a computed column. */
export type Event = Tables<"events">

// The columns the API's grants let a signed-in user write. Any non-null
// consent_accepted_at records consent; the database sets the time.
type VolunteerProfile = Pick<
  TablesInsert<"volunteers">,
  | "phone"
  | "location"
  | "availability_days"
  | "shift_preference"
  | "skills"
  | "emergency_contact_name"
  | "emergency_contact_phone"
  | "emergency_contact_relationship"
  | "consent_accepted_at"
>

export type VolunteerCreate = VolunteerProfile & Pick<TablesInsert<"volunteers">, "user_id">
export type VolunteerUpdate = VolunteerProfile

// The event columns staff can write; organization_id is set on create only.
type EventDetails = Pick<
  TablesInsert<"events">,
  | "status"
  | "title"
  | "description"
  | "category"
  | "location"
  | "requirements"
  | "starts_at"
  | "ends_at"
  | "capacity"
  | "registration_deadline"
>

export type EventCreate = EventDetails & Pick<TablesInsert<"events">, "organization_id">
export type EventUpdate = Partial<EventDetails>

export interface EventRepository {
  /** Events the signed-in user can see: published ones, plus drafts for staff and past ones they registered for. */
  getAll(): Promise<Event[]>
  getById(id: string): Promise<Event | null>
  create(input: EventCreate): Promise<Event>
  update(id: string, input: EventUpdate): Promise<Event>
}

export interface VolunteerRepository {
  /** Volunteers the signed-in user can see: their own profile, or their organization's for staff. */
  getAll(): Promise<Volunteer[]>
  getById(id: string): Promise<Volunteer | null>
  create(input: VolunteerCreate): Promise<Volunteer>
  update(id: string, input: VolunteerUpdate): Promise<Volunteer>
}
