import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CustomField } from "@/lib/customFieldAnswers"

import { cancelRegistrationAction, registerForEventAction } from "../api/actions"
import type { EventDetails } from "../api/eventDetails"
import { EventDetail } from "./EventDetail"
import { NOW, testEvent } from "./testEvent"

// The real actions need a Next.js request context; mock the server boundary.
vi.mock("../api/actions", () => ({
  registerForEventAction: vi.fn(),
  cancelRegistrationAction: vi.fn(),
}))

const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

const mockRegister = vi.mocked(registerForEventAction)
const mockCancel = vi.mocked(cancelRegistrationAction)

function question(overrides: Partial<CustomField>): CustomField {
  return {
    id: "q1",
    organization_id: "org-1",
    entity_type: "registration",
    field_name: "Why do you want to join?",
    field_type: "textarea",
    required: true,
    options: [],
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const questions = [
  question({}),
  question({ id: "q2", field_name: "Shirt size", field_type: "select", options: ["S", "M", "L"], required: false, position: 1 }),
]

function renderDetail(overrides: Partial<EventDetails> = {}) {
  return render(
    <EventDetail
      event={testEvent()}
      questions={[]}
      registration={null}
      volunteerStatus="approved"
      now={NOW}
      {...overrides}
    />
  )
}

const registerButton = () => screen.getByRole("button", { name: /^Register/ })

beforeEach(() => {
  mockRegister.mockReset()
  mockCancel.mockReset()
  mockRefresh.mockReset()
})

describe("EventDetail", () => {
  it("shows the event details, spots available, and an enabled register button", () => {
    renderDetail()

    expect(screen.getByRole("heading", { name: "Community Food Pantry Sort" })).toBeInTheDocument()
    expect(screen.getByText("Sort and pack donated groceries.")).toBeInTheDocument()
    expect(screen.getByText("Saturday, Oct 31")).toBeInTheDocument()
    expect(screen.getByText("Eastside Community Hub, 120 Example Street")).toBeInTheDocument()
    expect(screen.getByText("Closed-toe shoes.")).toBeInTheDocument()
    expect(screen.getByText("33 spots available")).toBeInTheDocument()
    expect(registerButton()).toBeEnabled()
  })

  it("registers straight away when there are no questions", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: true, data: { id: "reg-1" } })
    renderDetail()

    await user.click(registerButton())

    expect(mockRegister).toHaveBeenCalledWith(testEvent().id, {})
    expect(await screen.findByText("You're registered! We'll see you there.")).toBeInTheDocument()
    expect(screen.getByText("Registered")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel registration" })).toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("shows the custom questions before registering and submits the answers", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: true, data: { id: "reg-1" } })
    renderDetail({ questions })

    await user.click(registerButton())

    // Step 2: the questions, and nothing submitted yet.
    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "Registration" })).toBeInTheDocument()
    expect(screen.getByLabelText(/Why do you want to join\?/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Why do you want to join\?/), "To help out")
    await user.click(screen.getByRole("combobox", { name: /Shirt size/ }))
    await user.click(await screen.findByRole("option", { name: "M" }))
    await user.click(registerButton())

    expect(mockRegister).toHaveBeenCalledWith(testEvent().id, { q1: "To help out", q2: "M" })
    expect(await screen.findByText("Registered")).toBeInTheDocument()
  })

  it("requires required answers before submitting", async () => {
    const user = userEvent.setup()
    renderDetail({ questions })

    await user.click(registerButton())
    await user.click(registerButton())

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getByText("Why do you want to join? is required")).toBeInTheDocument()
    expect(screen.getByLabelText(/Why do you want to join\?/)).toHaveAttribute("aria-invalid", "true")
  })

  it("blocks a pending volunteer from registering and says why", () => {
    renderDetail({ volunteerStatus: "pending" })

    expect(registerButton()).toBeDisabled()
    expect(screen.getByText("Not eligible")).toBeInTheDocument()
    expect(screen.getByText(/application is still under review/)).toBeInTheDocument()
  })

  it.each([
    ["closed", { registration_deadline: "2026-11-01T00:00:00.000Z" }, "Registration closed"],
    ["full", { capacity: 7 }, "Event full"],
    ["unavailable", { status: "draft" as const }, "Unavailable"],
  ])("disables registration for a %s event", (_state, overrides, label) => {
    renderDetail({ event: testEvent(overrides) })

    expect(screen.getByRole("button", { name: label })).toBeDisabled()
  })

  it("doesn't guess why the server refused an approved-looking volunteer", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: false, error: { type: "not-eligible" } })
    // Status said approved at render, but approval may have been revoked since.
    renderDetail()

    await user.click(registerButton())

    expect(
      await screen.findByText("You can't register for this event right now. Refresh the page to see its latest status.")
    ).toBeInTheDocument()
    expect(screen.queryByText(/closed/)).not.toBeInTheDocument()
    expect(screen.queryByText("Registered")).not.toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("announces feedback through a live region that's always mounted", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: true, data: { id: "reg-1" } })
    const { container } = renderDetail()

    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toBeInTheDocument()
    expect(live).toBeEmptyDOMElement()

    await user.click(registerButton())

    expect(await screen.findByText("You're registered! We'll see you there.")).toBeInTheDocument()
    expect(container.querySelector('[aria-live="polite"]')).toBe(live)
    expect(live).toHaveTextContent("You're registered! We'll see you there.")
  })

  it("re-registers after a cancellation without asking the questions again", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: true, data: { id: "reg-1" } })
    renderDetail({ questions, registration: { id: "reg-1", status: "cancelled" } })

    await user.click(registerButton())

    expect(screen.queryByRole("heading", { name: "Registration" })).not.toBeInTheDocument()
    expect(mockRegister).toHaveBeenCalledWith(testEvent().id, {})
    expect(await screen.findByRole("button", { name: "Cancel registration" })).toBeInTheDocument()
  })

  it.each([
    ["cancelled", "Cancelled", "This event was cancelled."],
    ["completed", "Completed", "This event has ended."],
  ] as const)("shows a %s event's state with no register or cancel actions", (status, chip, notice) => {
    renderDetail({ event: testEvent({ status }), registration: { id: "reg-1", status: "registered" } })

    expect(screen.getByText(chip)).toBeInTheDocument()
    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(screen.queryByText("Registered")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Register|Cancel registration/ })).not.toBeInTheDocument()
  })

  it("explains a full event and refreshes the counts", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: false, error: { type: "full" } })
    renderDetail()

    await user.click(registerButton())

    expect(await screen.findByText("Sorry, this event just filled up.")).toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("never shows a raw backend message", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({ ok: false, error: { type: "backend", message: "relation does not exist" } })
    renderDetail()

    await user.click(registerButton())

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument()
    expect(screen.queryByText(/relation does not exist/)).not.toBeInTheDocument()
  })

  it("shows server-side answer errors next to the question", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({
      ok: false,
      error: { type: "validation", fieldErrors: { q1: ["Why do you want to join? has an invalid value"] } },
    })
    renderDetail({ questions })

    await user.click(registerButton())
    await user.type(screen.getByLabelText(/Why do you want to join\?/), "Because")
    await user.click(registerButton())

    expect(await screen.findByText("Why do you want to join? has an invalid value")).toBeInTheDocument()
    expect(screen.getByText("Check your answers and try again.")).toBeInTheDocument()
  })

  it("cancels an existing registration", async () => {
    const user = userEvent.setup()
    mockCancel.mockResolvedValue({ ok: true, data: { id: "reg-1" } })
    renderDetail({ registration: { id: "reg-1", status: "registered" } })

    expect(screen.queryByRole("button", { name: /^Register/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel registration" }))

    expect(mockCancel).toHaveBeenCalledWith("reg-1")
    expect(await screen.findByText("Your registration was cancelled.")).toBeInTheDocument()
    expect(registerButton()).toBeEnabled()
  })

  it("explains a cancellation that's no longer allowed", async () => {
    const user = userEvent.setup()
    mockCancel.mockResolvedValue({ ok: false, error: { type: "not-eligible" } })
    renderDetail({ registration: { id: "reg-1", status: "registered" } })

    await user.click(screen.getByRole("button", { name: "Cancel registration" }))

    expect(await screen.findByText("This registration can't be cancelled anymore.")).toBeInTheDocument()
  })
})
