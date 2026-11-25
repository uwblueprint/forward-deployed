import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EventList } from "./EventList"
import { NOW, testEvent } from "./testEvent"

function card(title: string) {
  return screen.getByRole("link", { name: new RegExp(title) })
}

describe("EventList", () => {
  it("shows each event's name, date, location, category, and spots left", () => {
    render(<EventList events={[testEvent()]} volunteerStatus="approved" filtered={false} now={NOW} />)

    const link = card("Community Food Pantry Sort")
    expect(link).toHaveAttribute("href", "/events/6f1c2c1e-2a4b-4c55-9a1d-1f0e8b7c6d5a")
    expect(within(link).getByText("Saturday, Oct 31")).toBeInTheDocument()
    expect(within(link).getByText(/6:00 PM – 8:00 PM/)).toBeInTheDocument()
    expect(within(link).getByText("Eastside Community Hub, 120 Example Street")).toBeInTheDocument()
    expect(within(link).getByText("Food security")).toBeInTheDocument()
    expect(within(link).getByText("33 spots")).toBeInTheDocument()
  })

  it("labels closed, full, and cancelled events instead of spots", () => {
    render(
      <EventList
        events={[
          testEvent({ id: "a", title: "Deadline passed", registration_deadline: "2026-11-01T00:00:00.000Z" }),
          testEvent({ id: "b", title: "Sold out", capacity: 7 }),
          testEvent({ id: "c", title: "Called off", status: "cancelled" }),
          testEvent({ id: "d", title: "No limit", capacity: null }),
        ]}
        volunteerStatus="approved"
        filtered={false}
        now={NOW}
      />
    )

    expect(within(card("Deadline passed")).getByText("Registration closed")).toBeInTheDocument()
    expect(within(card("Sold out")).getByText("Full")).toBeInTheDocument()
    expect(within(card("Called off")).getByText("Cancelled")).toBeInTheDocument()
    expect(within(card("No limit")).getByText("Open")).toBeInTheDocument()
  })

  it("marks open events not eligible for a pending volunteer and says why", () => {
    render(<EventList events={[testEvent()]} volunteerStatus="pending" filtered={false} now={NOW} />)

    expect(within(card("Community Food Pantry Sort")).getByText("Not eligible")).toBeInTheDocument()
    expect(screen.getByText(/application is still under review/)).toBeInTheDocument()
  })

  it("shows the empty state, with filter advice when filtered", () => {
    const { rerender } = render(<EventList events={[]} volunteerStatus="approved" filtered={false} now={NOW} />)
    expect(screen.getByText("No events found")).toBeInTheDocument()
    expect(screen.getByText("Check back soon for new events.")).toBeInTheDocument()

    rerender(<EventList events={[]} volunteerStatus="approved" filtered now={NOW} />)
    expect(screen.getByText("Try a different search or clear your filters.")).toBeInTheDocument()
  })
})
