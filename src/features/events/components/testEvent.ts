import type { Event } from "@/lib/adapters/types"

/** Test fixture: an open, published event far in the future. */
export function testEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "6f1c2c1e-2a4b-4c55-9a1d-1f0e8b7c6d5a",
    organization_id: "org-1",
    status: "published",
    title: "Community Food Pantry Sort",
    description: "Sort and pack donated groceries.",
    category: "Food security",
    location: "Eastside Community Hub, 120 Example Street",
    requirements: "Closed-toe shoes.",
    starts_at: "2099-10-31T22:00:00.000Z",
    ends_at: "2099-11-01T00:00:00.000Z",
    capacity: 40,
    registration_deadline: null,
    registration_count: 7,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

export const NOW = Date.parse("2026-11-19T12:00:00.000Z")
