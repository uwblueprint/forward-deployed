import type { Tables } from "@/lib/supabase/database.types"
import type { Event, Volunteer } from "../types"

// Hand-written so the mocks need no database or extra packages. Dates are
// relative to when the module loads, so upcoming events stay upcoming. The
// community dinner is full (registration_count equals capacity).
const DAY_MS = 24 * 60 * 60 * 1000
const CREATED_AT = "2026-10-01T12:00:00.000Z"
const at = (days: number, hour = 9) => {
  const date = new Date(Date.now() + days * DAY_MS)
  date.setUTCHours(hour, 0, 0, 0)
  return date.toISOString()
}

export const MOCK_ORGANIZATIONS: Tables<"organizations">[] = [
  {
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Waterloo Region Food Bank",
    logo_url: null,
    primary_color: "#2f6b3a",
    secondary_color: "#f2c14e",
    settings: {},
    default_rejection_message: "Thanks for applying. We can't offer you a spot right now.",
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a2",
    name: "Grand River Literacy Council",
    logo_url: null,
    primary_color: "#1f4e79",
    secondary_color: "#e8eef5",
    settings: {},
    default_rejection_message: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
]

const [FOOD_BANK, LITERACY] = MOCK_ORGANIZATIONS.map((org) => org.id)

function volunteer(n: number, fields: Partial<Volunteer> & Pick<Volunteer, "organization_id" | "status">): Volunteer {
  const id = n.toString().padStart(12, "0")
  return {
    id: `00000000-0000-4000-8001-${id}`,
    user_id: `00000000-0000-4000-8002-${id}`,
    phone: null,
    location: null,
    availability_days: [],
    shift_preference: null,
    skills: [],
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    consent_accepted_at: CREATED_AT,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    ...fields,
  }
}

export const MOCK_VOLUNTEERS: Volunteer[] = [
  volunteer(1, { organization_id: FOOD_BANK, status: "approved", phone: "519-555-0101", location: "Kitchener, ON", availability_days: ["monday", "wednesday"], shift_preference: "morning", skills: ["Driving", "First aid"], emergency_contact_name: "Priya Shah", emergency_contact_phone: "519-555-0191", emergency_contact_relationship: "Sibling" }),
  volunteer(2, { organization_id: FOOD_BANK, status: "approved", phone: "519-555-0102", location: "Waterloo, ON", availability_days: ["saturday"], shift_preference: "afternoon", skills: ["Cooking"] }),
  volunteer(3, { organization_id: FOOD_BANK, status: "approved", phone: "226-555-0103", location: "Cambridge, ON", availability_days: ["tuesday", "thursday"], shift_preference: "evening", skills: ["Event setup"] }),
  volunteer(4, { organization_id: FOOD_BANK, status: "pending", phone: "519-555-0104", location: "Kitchener, ON", availability_days: ["friday"], shift_preference: "morning" }),
  volunteer(5, { organization_id: FOOD_BANK, status: "pending", location: "Guelph, ON", availability_days: ["sunday"], skills: ["Translation"] }),
  volunteer(6, { organization_id: FOOD_BANK, status: "rejected", phone: "519-555-0106", location: "Elmira, ON" }),
  volunteer(7, { organization_id: LITERACY, status: "approved", phone: "519-555-0107", location: "Waterloo, ON", availability_days: ["monday", "tuesday"], shift_preference: "evening", skills: ["Tutoring"] }),
  volunteer(8, { organization_id: LITERACY, status: "approved", phone: "226-555-0108", location: "Kitchener, ON", availability_days: ["wednesday"], shift_preference: "afternoon", skills: ["Tutoring", "Translation"] }),
  volunteer(9, { organization_id: LITERACY, status: "approved", location: "Waterloo, ON", availability_days: ["saturday", "sunday"], skills: ["Social media"] }),
  volunteer(10, { organization_id: LITERACY, status: "pending", phone: "519-555-0110", location: "Cambridge, ON", availability_days: ["thursday"], shift_preference: "evening" }),
  volunteer(11, { organization_id: LITERACY, status: "pending", location: "Kitchener, ON" }),
  volunteer(12, { organization_id: LITERACY, status: "rejected", phone: "519-555-0112", location: "St. Jacobs, ON" }),
]

function event(n: number, fields: Pick<Event, "organization_id" | "status" | "title" | "starts_at" | "ends_at"> & Partial<Event>): Event {
  return {
    id: `00000000-0000-4000-8003-${n.toString().padStart(12, "0")}`,
    description: null,
    category: null,
    location: null,
    requirements: null,
    capacity: null,
    registration_deadline: null,
    registration_count: 0,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    ...fields,
  }
}

export const MOCK_EVENTS: Event[] = [
  event(1, { organization_id: FOOD_BANK, status: "published", title: "Saturday sorting shift", category: "Food security", location: "50 Alpine Ct, Kitchener", requirements: "Closed-toe shoes required.", capacity: 20, registration_count: 7, starts_at: at(3), ends_at: at(3, 12), registration_deadline: at(2) }),
  event(2, { organization_id: FOOD_BANK, status: "published", title: "Community dinner", category: "Community outreach", location: "St. Mary's Hall, Waterloo", capacity: 2, registration_count: 2, starts_at: at(8, 17), ends_at: at(8, 20) }),
  event(3, { organization_id: FOOD_BANK, status: "draft", title: "Holiday hamper drive", category: "Fundraising", starts_at: at(30), ends_at: at(30, 15) }),
  event(4, { organization_id: FOOD_BANK, status: "completed", title: "Fall harvest pickup", category: "Food security", location: "Elmira Farmers Market", capacity: 15, registration_count: 11, starts_at: at(-10), ends_at: at(-10, 13) }),
  event(5, { organization_id: LITERACY, status: "published", title: "After-school homework club", category: "Tutoring", location: "Kitchener Public Library", requirements: "Must be 16 or older.", capacity: 10, registration_count: 4, starts_at: at(5, 15), ends_at: at(5, 17) }),
  event(6, { organization_id: LITERACY, status: "cancelled", title: "Book fair setup", category: "Event setup", location: "Waterloo Region Museum", starts_at: at(12), ends_at: at(12, 14) }),
]
