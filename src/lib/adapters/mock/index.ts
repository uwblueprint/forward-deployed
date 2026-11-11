import type {
  Event,
  EventCreate,
  EventRepository,
  EventUpdate,
  Volunteer,
  VolunteerCreate,
  VolunteerRepository,
  VolunteerUpdate,
} from "../types"
import { MOCK_EVENTS, MOCK_ORGANIZATIONS, MOCK_VOLUNTEERS } from "./data"

export { MOCK_EVENTS, MOCK_ORGANIZATIONS, MOCK_VOLUNTEERS }

/** How long every mock call takes, to imitate a network round trip. */
export const MOCK_LATENCY_MS = 200

const delay = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
const copy = <T>(value: T): T => structuredClone(value)

/**
 * Volunteers held in memory, starting from MOCK_VOLUNTEERS. There's no
 * signed-in user, so every row is visible. Like the database, new profiles
 * start pending and any consent is stamped with the current time.
 */
export class MockVolunteerRepository implements VolunteerRepository {
  private volunteers = copy(MOCK_VOLUNTEERS)

  async getAll() {
    await delay()
    return copy(this.volunteers)
  }

  async getById(id: string) {
    await delay()
    const volunteer = this.volunteers.find((v) => v.id === id)
    return volunteer ? copy(volunteer) : null
  }

  async create(input: VolunteerCreate) {
    await delay()
    const now = new Date().toISOString()
    const volunteer: Volunteer = {
      id: crypto.randomUUID(),
      organization_id: MOCK_ORGANIZATIONS[0].id,
      status: "pending",
      phone: null,
      location: null,
      availability_days: [],
      shift_preference: null,
      skills: [],
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relationship: null,
      created_at: now,
      updated_at: now,
      ...input,
      consent_accepted_at: input.consent_accepted_at ? now : null,
    }
    this.volunteers.push(volunteer)
    return copy(volunteer)
  }

  async update(id: string, input: VolunteerUpdate) {
    await delay()
    const index = this.volunteers.findIndex((v) => v.id === id)
    if (index === -1) throw new Error(`No volunteer with id ${id}`)
    const current = this.volunteers[index]
    const now = new Date().toISOString()
    this.volunteers[index] = {
      ...current,
      ...input,
      consent_accepted_at: input.consent_accepted_at === undefined ? current.consent_accepted_at : input.consent_accepted_at && (current.consent_accepted_at ?? now),
      updated_at: now,
    }
    return copy(this.volunteers[index])
  }
}

/** Events held in memory, starting from MOCK_EVENTS. Every event is visible, drafts included. */
export class MockEventRepository implements EventRepository {
  private events = copy(MOCK_EVENTS)

  async getAll() {
    await delay()
    return copy(this.events)
  }

  async getById(id: string) {
    await delay()
    const event = this.events.find((e) => e.id === id)
    return event ? copy(event) : null
  }

  async create(input: EventCreate) {
    await delay()
    const now = new Date().toISOString()
    const event: Event = {
      id: crypto.randomUUID(),
      status: "draft",
      description: null,
      category: null,
      location: null,
      requirements: null,
      capacity: null,
      registration_deadline: null,
      registration_count: 0,
      created_at: now,
      updated_at: now,
      ...input,
    }
    this.events.push(event)
    return copy(event)
  }

  async update(id: string, input: EventUpdate) {
    await delay()
    const index = this.events.findIndex((e) => e.id === id)
    if (index === -1) throw new Error(`No event with id ${id}`)
    this.events[index] = { ...this.events[index], ...input, updated_at: new Date().toISOString() }
    return copy(this.events[index])
  }
}
