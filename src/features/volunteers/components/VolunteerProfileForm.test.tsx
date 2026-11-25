import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUpdateVolunteerProfileAction } = vi.hoisted(() => ({
  mockUpdateVolunteerProfileAction: vi.fn(),
}))

vi.mock("../api/actions", () => ({ updateVolunteerProfileAction: mockUpdateVolunteerProfileAction }))

import { VolunteerProfileForm, type VolunteerProfileFormValues } from "./VolunteerProfileForm"

const initialValues: VolunteerProfileFormValues = {
  phone: "555-123-4567",
  location: "Waterloo",
  weekdays: ["monday"],
  shiftPreference: "morning",
  skills: ["Juggling"],
  emergencyContactName: "Jamie",
  emergencyContactPhone: "555-987-6543",
  emergencyContactRelationship: "Friend",
}

function renderForm() {
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  render(
    <VolunteerProfileForm
      volunteerId="v1"
      initialValues={initialValues}
      skillOptions={["Cooking", "Driving"]}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  )
  return { onSaved, onCancel }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("VolunteerProfileForm", () => {
  it("saves a changed phone, availability, and skills", async () => {
    const user = userEvent.setup()
    mockUpdateVolunteerProfileAction.mockResolvedValue({ ok: true, data: { id: "v1" } })
    const { onSaved } = renderForm()

    await user.clear(screen.getByLabelText("Phone"))
    await user.type(screen.getByLabelText("Phone"), "555-000-1111")
    await user.click(screen.getByRole("checkbox", { name: "friday" }))
    await user.click(screen.getByRole("checkbox", { name: "Cooking" }))
    await user.type(screen.getByRole("textbox", { name: "Add a skill" }), "Sign language{Enter}")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(mockUpdateVolunteerProfileAction).toHaveBeenCalledWith("v1", {
      ...initialValues,
      phone: "555-000-1111",
      weekdays: ["monday", "friday"],
      skills: ["Juggling", "Cooking", "Sign language"],
    })
  })

  it("offers the organization's skills and the volunteer's own", () => {
    renderForm()
    expect(screen.getByRole("checkbox", { name: "Cooking" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Driving" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Juggling" })).toBeChecked()
  })

  it("shows field errors without saving", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(screen.getByLabelText("Location"))
    await user.click(screen.getByRole("checkbox", { name: "monday" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Location is required")).toBeInTheDocument()
    expect(screen.getByText("Select at least one day you're available")).toBeInTheDocument()
    expect(screen.getByLabelText("Location")).toHaveAttribute("aria-invalid", "true")
    expect(mockUpdateVolunteerProfileAction).not.toHaveBeenCalled()
  })

  it("shows the server's field errors", async () => {
    const user = userEvent.setup()
    mockUpdateVolunteerProfileAction.mockResolvedValue({
      ok: false,
      error: { type: "validation", fieldErrors: { phone: ["Enter a valid phone number"] } },
    })
    const { onSaved } = renderForm()

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Enter a valid phone number")).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("says so when the save fails", async () => {
    const user = userEvent.setup()
    mockUpdateVolunteerProfileAction.mockRejectedValue(new Error("network"))
    renderForm()

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Couldn't save the profile. Try again.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
  })

  it("cancels", async () => {
    const user = userEvent.setup()
    const { onCancel } = renderForm()

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onCancel).toHaveBeenCalled()
  })
})
