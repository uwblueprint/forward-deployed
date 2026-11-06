import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { loadDraft } from "@/components/common/forms"

import { submitVolunteerOnboardingAction } from "../api/actions"
import { VolunteerOnboardingWizard } from "./VolunteerOnboardingWizard"

const FORM_ID = "volunteer-onboarding"

// The real action calls createServerSupabaseClient(), which needs an actual
// Next.js request context (cookies(), connection()) that doesn't exist in a
// component test - mock the network/server boundary instead, same as any
// other external call.
vi.mock("../api/actions", () => ({
  submitVolunteerOnboardingAction: vi.fn(),
}))

const mockSubmitAction = vi.mocked(submitVolunteerOnboardingAction)

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First name"), "Ada")
  await user.type(screen.getByLabelText("Last name"), "Lovelace")
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
    mockSubmitAction.mockReset()
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
    expect(screen.getByText("First name is required")).toBeInTheDocument()
    expect(screen.getByText("Last name is required")).toBeInTheDocument()
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
    expect(screen.getByLabelText("First name")).toHaveValue("Ada")
    expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace")
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
    expect(mockSubmitAction).not.toHaveBeenCalled()
  })

  it("submits the complete validated payload to the server action, then clears the draft", async () => {
    mockSubmitAction.mockResolvedValue({ ok: true, data: null })
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepThree(user)
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText("You're all set!")).toBeInTheDocument()

    expect(mockSubmitAction).toHaveBeenCalledTimes(1)
    expect(mockSubmitAction).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        weekdays: ["monday"],
        shiftPreference: "morning",
        skills: ["First aid"],
        emergencyContactName: "Grace Hopper",
        agreedToTerms: true,
      })
    )

    const payloadPre = screen.getByText(/"firstName"/)
    expect(within(payloadPre).getByText(/Ada/)).toBeInTheDocument()

    // The draft is cleared after a successful submit so PII doesn't linger.
    expect(loadDraft(FORM_ID)).toBeUndefined()
  })

  it("shows an error and keeps the draft when the server action reports a backend failure", async () => {
    mockSubmitAction.mockResolvedValue({ ok: false, error: { type: "backend", message: "boom" } })
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepThree(user)
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(
      await screen.findByText("Something went wrong submitting your onboarding form. Please try again.")
    ).toBeInTheDocument()
    expect(screen.queryByText("You're all set!")).not.toBeInTheDocument()

    // Not cleared - the user hasn't actually submitted successfully yet.
    expect(loadDraft(FORM_ID)).not.toBeUndefined()
  })

  it("shows a generic error when the server action rejects outright instead of returning ok:false", async () => {
    // e.g. an infra error thrown before the action could return a
    // structured result - distinct from the mockResolvedValue({ok:false})
    // case above, and previously fell through as a silent unhandled
    // rejection with no visible feedback at all.
    mockSubmitAction.mockRejectedValue(new Error("boom"))
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepThree(user)
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(
      await screen.findByText("Something went wrong submitting your onboarding form. Please try again.")
    ).toBeInTheDocument()
    expect(screen.queryByText("You're all set!")).not.toBeInTheDocument()
    expect(loadDraft(FORM_ID)).not.toBeUndefined()
  })

  it("shows a session-expired message when the server action reports unauthenticated", async () => {
    mockSubmitAction.mockResolvedValue({ ok: false, error: { type: "unauthenticated" } })
    const user = userEvent.setup()
    render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepTwo(user)
    await user.click(screen.getByRole("button", { name: "Next" }))
    await fillStepThree(user)
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(
      await screen.findByText("Your session has expired. Please sign in again to finish onboarding.")
    ).toBeInTheDocument()
  })

  it("restores a saved draft for the same formId on a fresh mount (simulated reload)", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<VolunteerOnboardingWizard />)

    await fillStepOne(user)
    unmount()

    render(<VolunteerOnboardingWizard />)

    expect(await screen.findByLabelText("First name")).toHaveValue("Ada")
    expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace")
  })
})
