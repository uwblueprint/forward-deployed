import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { VolunteerDetails } from "../api/volunteerDetails"

const { refresh, mockUpdateVolunteerProfileAction, mockUpdateUserNameAction } = vi.hoisted(() => ({
  refresh: vi.fn(),
  mockUpdateVolunteerProfileAction: vi.fn(),
  mockUpdateUserNameAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
vi.mock("../api/actions", () => ({
  updateVolunteerProfileAction: mockUpdateVolunteerProfileAction,
  updateUserNameAction: mockUpdateUserNameAction,
}))

import { VolunteerProfile } from "./VolunteerProfile"

const details: VolunteerDetails = {
  volunteer: {
    id: "v1",
    user_id: "u1",
    organization_id: "o1",
    status: "rejected",
    phone: "555-123-4567",
    location: "Waterloo, ON",
    availability_days: ["saturday", "monday"],
    shift_preference: "evening",
    skills: ["Cooking", "Driving"],
    emergency_contact_name: "Jamie Lee",
    emergency_contact_phone: "555-987-6543",
    emergency_contact_relationship: "Sibling",
    consent_accepted_at: "2026-10-01T12:00:00Z",
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
  },
  user: { id: "u1", first_name: "Sam", last_name: "Lee", email: "sam@example.com" },
  latestApplication: {
    id: "a1",
    status: "rejected",
    applicantMessage: "Not this season",
    submittedAt: "2026-10-02T12:00:00Z",
    reviewedAt: "2026-10-03T12:00:00Z",
  },
  events: [
    {
      registrationId: "r1",
      registrationStatus: "registered",
      attendance: "attended",
      event: {
        id: "e1",
        title: "Park cleanup",
        starts_at: "2026-09-12T14:00:00Z",
        ends_at: "2026-09-12T17:30:00Z",
        status: "completed",
      },
    },
    {
      registrationId: "r2",
      registrationStatus: "cancelled",
      attendance: null,
      event: {
        id: "e2",
        title: "Community dinner",
        starts_at: "2026-08-01T22:00:00Z",
        ends_at: "2026-08-02T01:00:00Z",
        status: "cancelled",
      },
    },
  ],
  eventsAttended: 1,
  hours: 3.5,
  skillOptions: ["Cooking", "Driving", "First aid"],
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("VolunteerProfile", () => {
  it("shows the profile, latest application, and event history", () => {
    render(<VolunteerProfile details={details} canRename={false} />)

    expect(screen.getByRole("heading", { name: "Sam Lee" })).toBeInTheDocument()
    expect(screen.getByText("sam@example.com")).toBeInTheDocument()
    expect(screen.getByText("Mon, Sat")).toBeInTheDocument()
    expect(screen.getByText("Evening")).toBeInTheDocument()
    expect(screen.getByText("Jamie Lee (Sibling) · 555-987-6543")).toBeInTheDocument()

    expect(screen.getByText("Not this season")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open application" })).toHaveAttribute("href", "/admin/applications/a1")

    expect(screen.getByText("1 event attended · 3.5 hours")).toBeInTheDocument()
    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Park cleanup",
      "Sep 12, 2026",
      "Registered",
      "Attended",
    ])
    // Dates are shown in the organization's zone: 22:00 UTC is still Aug 1 in Waterloo.
    expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Community dinner (event cancelled)",
      "Aug 1, 2026",
      "Cancelled",
      "—",
    ])
  })

  it("handles a volunteer with no application or signups", () => {
    render(
      <VolunteerProfile
        details={{ ...details, latestApplication: null, events: [], eventsAttended: 0, hours: 0 }}
        canRename={false}
      />
    )

    expect(screen.getByText("No application yet.")).toBeInTheDocument()
    expect(screen.getByText("No event signups yet.")).toBeInTheDocument()
    expect(screen.getByText("0 events attended · 0 hours")).toBeInTheDocument()
  })

  it("only offers rename when allowed", () => {
    const { rerender } = render(<VolunteerProfile details={details} canRename={false} />)
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument()

    rerender(<VolunteerProfile details={details} canRename />)
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument()
  })

  it("renames and refreshes the page", async () => {
    const user = userEvent.setup()
    mockUpdateUserNameAction.mockResolvedValue({ ok: true, data: { firstName: "Samira", lastName: "Lee" } })
    render(<VolunteerProfile details={details} canRename />)

    await user.click(screen.getByRole("button", { name: "Rename" }))
    await user.clear(screen.getByLabelText("First name"))
    await user.type(screen.getByLabelText("First name"), "Samira")
    await user.click(screen.getByRole("button", { name: "Save name" }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(mockUpdateUserNameAction).toHaveBeenCalledWith("u1", { firstName: "Samira", lastName: "Lee" })
    expect(screen.queryByRole("form", { name: "Rename" })).not.toBeInTheDocument()
  })

  it("edits the profile and refreshes the page", async () => {
    const user = userEvent.setup()
    mockUpdateVolunteerProfileAction.mockResolvedValue({ ok: true, data: { id: "v1" } })
    render(<VolunteerProfile details={details} canRename={false} />)

    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(screen.getByLabelText("Phone")).toHaveValue("555-123-4567")
    await user.clear(screen.getByLabelText("Phone"))
    await user.type(screen.getByLabelText("Phone"), "555-000-1111")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(mockUpdateVolunteerProfileAction).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ phone: "555-000-1111", weekdays: ["monday", "saturday"], shiftPreference: "evening" })
    )
    expect(screen.queryByRole("form", { name: "Edit profile" })).not.toBeInTheDocument()
  })
})
