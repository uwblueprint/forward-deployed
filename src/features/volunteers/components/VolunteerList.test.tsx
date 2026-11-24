import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { VolunteerWithUser } from "@/lib/adapters"
import { MOCK_VOLUNTEERS } from "@/lib/adapters/mock"

import { VolunteerList } from "./VolunteerList"

function volunteer(fields: Partial<VolunteerWithUser>): VolunteerWithUser {
  return { ...MOCK_VOLUNTEERS[0], user: null, ...fields }
}

const volunteers: VolunteerWithUser[] = [
  volunteer({
    id: "v1",
    status: "approved",
    location: "Kitchener, ON",
    availability_days: ["wednesday", "monday"],
    skills: ["Driving", "First aid"],
    created_at: "2026-10-01T12:00:00.000Z",
    user: { first_name: "Zara", last_name: "Ali", email: "zara@example.com" },
  }),
  volunteer({
    id: "v2",
    status: "pending",
    location: null,
    availability_days: [],
    skills: [],
    user: { first_name: "Maya", last_name: "Chen", email: "maya@example.com" },
  }),
  volunteer({ id: "v3", user: null }),
]

function bodyRows() {
  return screen.getAllByRole("row").slice(1)
}

describe("VolunteerList", () => {
  it("renders the volunteer columns", () => {
    render(<VolunteerList volunteers={volunteers} />)
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Name",
      "Email",
      "Status",
      "Location",
      "Availability",
      "Skills",
      "Joined",
    ])
  })

  it("sorts by name and formats each field", () => {
    render(<VolunteerList volunteers={volunteers} />)
    const zara = bodyRows().find((r) => within(r).queryByText("Zara Ali"))!
    expect(within(zara).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Zara Ali",
      "zara@example.com",
      "Approved",
      "Kitchener, ON",
      "Mon, Wed", // week order, not stored order
      "Driving, First aid",
      "Oct 1, 2026",
    ])
    // "—" (hidden user) sorts after letters.
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "Maya Chen",
      "Zara Ali",
      "—",
    ])
  })

  it("links each name to the volunteer's profile", () => {
    render(<VolunteerList volunteers={volunteers} />)
    expect(screen.getByRole("link", { name: "Zara Ali" })).toHaveAttribute("href", "/admin/volunteers/v1")
    expect(screen.getByRole("link", { name: "—" })).toHaveAttribute("href", "/admin/volunteers/v3")
  })

  it("shows placeholders for missing data", () => {
    render(<VolunteerList volunteers={volunteers} />)
    const maya = bodyRows().find((r) => within(r).queryByText("Maya Chen"))!
    const cells = within(maya).getAllByRole("cell").map((c) => c.textContent)
    expect(cells.slice(3, 6)).toEqual(["—", "—", "—"])
  })

  it("shows the empty state with no volunteers", () => {
    render(<VolunteerList volunteers={[]} />)
    expect(screen.getByRole("cell", { name: "No records found" })).toBeInTheDocument()
  })
})
