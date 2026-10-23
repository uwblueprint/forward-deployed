import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { loadDraft } from "@/components/common/forms"

import { VolunteerOnboardingWizard } from "./VolunteerOnboardingWizard"

const FORM_ID = "volunteer-onboarding"

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Ada Lovelace")
  await user.type(screen.getByLabelText("Email"), "ada@example.com")
  await user.type(screen.getByLabelText("Phone"), "555-123-4567")
  await user.type(screen.getByLabelText("Location"), "London, UK")
}

async function fillStepTwo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("monday"))
  await user.click(screen.getByRole("combobox", { name: "Shift preference" }))
  await user.click(await screen.findByRole("option", { name: "morning" }))
}

async function fillStepThree(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("First aid"))
  await user.type(screen.getByLabelText("Emergency contact name"), "Grace Hopper")
  await user.type(screen.getByLabelText("Emergency contact phone"), "555-987-6543")
  await user.type(screen.getByLabelText("Relationship"), "Sister")
  await user.click(screen.getByLabelText("I agree to the volunteer terms and conditions"))
}

describe("VolunteerOnboardingWizard", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts on step 1 of 3 with Back disabled", () => {
    render(<VolunteerOnboardingWizard />)

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument()
  })

  it("blocks advancing past step 1 and shows field errors when data is invalid", async () => {
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await user.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument()
    expect(screen.getByText("Full name is required")).toBeInTheDocument()
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument()
  })

  it("advances through all three steps once each step's data is valid", async () => {
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument()

    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
  })

  it("keeps entered values when navigating back to a previous step", async () => {
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Back" }))

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument()
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Lovelace")
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com")
  })

  it("blocks final submission with field errors when step 3 is invalid", async () => {
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))

    // Leave step 3 blank and try to submit.
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument()
    expect(screen.getByText("Select or enter at least one skill")).toBeInTheDocument()
    expect(screen.getByText("You must accept the terms to continue")).toBeInTheDocument()
  })

  it("logs and submits the complete validated payload, then clears the draft", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepThree(user)
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText("You're all set!")).toBeInTheDocument()

    const loggedPayload = consoleSpy.mock.calls.find(
      (call) => call[0] === "Volunteer onboarding submitted:"
    )?.[1]
    expect(loggedPayload).toMatchObject({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      weekdays: ["monday"],
      shiftPreference: "morning",
      skills: ["First aid"],
      emergencyContactName: "Grace Hopper",
      agreedToTerms: true,
    })

    const payloadPre = screen.getByText(/"fullName"/)
    expect(within(payloadPre).getByText(/Ada Lovelace/)).toBeInTheDocument()

    // The draft is cleared after a successful submit so PII doesn't linger.
    expect(loadDraft(FORM_ID)).toBeUndefined()

    consoleSpy.mockRestore()
  })

  it("restores a saved draft for the same formId on a fresh mount (simulated reload)", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    unmount()

    render(<VolunteerOnboardingWizard />)

    expect(await screen.findByLabelText("Full name")).toHaveValue("Ada Lovelace")
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com")
  })
})
