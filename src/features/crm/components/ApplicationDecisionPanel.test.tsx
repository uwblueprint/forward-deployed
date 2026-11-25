import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockDecide, mockEditMessage, mockRefresh } = vi.hoisted(() => ({
  mockDecide: vi.fn(),
  mockEditMessage: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }))
vi.mock("../api/actions", () => ({
  approveOrRejectApplicationAction: mockDecide,
  editApplicantMessageAction: mockEditMessage,
}))

import { ApplicationDecisionPanel, type ApplicationDecisionPanelProps } from "./ApplicationDecisionPanel"

const APP_ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"

function panel(overrides: Partial<ApplicationDecisionPanelProps> = {}) {
  return (
    <ApplicationDecisionPanel
      applicationId={APP_ID}
      applicantName="Ana Doe"
      status="pending"
      applicantMessage={null}
      canWriteNote={false}
      hasNote={false}
      {...overrides}
    />
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mockDecide.mockResolvedValue({ ok: true, data: { status: "approved" } })
})

describe("ApplicationDecisionPanel", () => {
  it("offers approve and reject on a pending application, and nothing that returns to pending afterwards", () => {
    const { rerender } = render(panel())
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()

    rerender(panel({ status: "approved" }))
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Change to rejected"])

    rerender(panel({ status: "rejected", applicantMessage: "No" }))
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Change to approved", "Edit message"])
  })

  it("rejects with the trimmed message against the status the reviewer saw", async () => {
    const user = userEvent.setup()
    render(panel())

    await user.click(screen.getByRole("button", { name: "Reject" }))
    await user.type(screen.getByLabelText("Message to the volunteer"), "  Try again in spring  ")
    await user.click(screen.getByRole("dialog").querySelector("button[type=submit]")!)

    await waitFor(() => expect(mockDecide).toHaveBeenCalledTimes(1))
    expect(mockDecide).toHaveBeenCalledWith(APP_ID, "rejected", "Try again in spring", {
      expectedStatus: "pending",
      note: undefined,
    })
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it("sends no message when only whitespace was typed, so the default applies", async () => {
    const user = userEvent.setup()
    render(panel())

    await user.click(screen.getByRole("button", { name: "Reject" }))
    await user.type(screen.getByLabelText("Message to the volunteer"), "  {Enter}  ")
    await user.click(screen.getByRole("dialog").querySelector("button[type=submit]")!)

    await waitFor(() => expect(mockDecide).toHaveBeenCalledWith(APP_ID, "rejected", undefined, expect.anything()))
  })

  it("only shows the note field to someone who can write notes, and only sends a note that was typed", async () => {
    const user = userEvent.setup()
    const { unmount } = render(panel())
    await user.click(screen.getByRole("button", { name: "Approve" }))
    expect(screen.queryByLabelText("Internal note")).not.toBeInTheDocument()
    unmount()

    render(panel({ canWriteNote: true }))
    await user.click(screen.getByRole("button", { name: "Approve" }))
    await user.type(screen.getByLabelText("Internal note"), "References checked")
    await user.click(screen.getByRole("dialog").querySelector("button[type=submit]")!)

    await waitFor(() =>
      expect(mockDecide).toHaveBeenCalledWith(APP_ID, "approved", undefined, {
        expectedStatus: "pending",
        note: "References checked",
      })
    )
  })

  it("never lets an open dialog overturn a decision someone else made in the meantime", async () => {
    const user = userEvent.setup()
    mockDecide.mockResolvedValue({ ok: false, error: { type: "already-decided" } })
    const { rerender } = render(panel())

    await user.click(screen.getByRole("button", { name: "Approve" }))
    const submit = () => screen.getByRole("dialog").querySelector<HTMLButtonElement>("button[type=submit]")!
    await user.click(submit())
    await screen.findByText(/someone else just changed this application/i)

    // The page refreshes behind the dialog and now says "rejected".
    rerender(panel({ status: "rejected", applicantMessage: "No" }))

    expect(submit()).toBeDisabled()
    await user.click(submit())
    expect(mockDecide).toHaveBeenCalledTimes(1)
    expect(mockDecide).toHaveBeenCalledWith(APP_ID, "approved", undefined, expect.objectContaining({ expectedStatus: "pending" }))
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()
  })

  it("changes a decision by naming the current status", async () => {
    const user = userEvent.setup()
    render(panel({ status: "rejected", applicantMessage: "No" }))

    await user.click(screen.getByRole("button", { name: "Change to approved" }))
    await user.click(screen.getByRole("dialog").querySelector("button[type=submit]")!)

    await waitFor(() =>
      expect(mockDecide).toHaveBeenCalledWith(APP_ID, "approved", undefined, expect.objectContaining({ expectedStatus: "rejected" }))
    )
  })

  it("edits a rejection message without deciding again", async () => {
    const user = userEvent.setup()
    mockEditMessage.mockResolvedValue({ ok: true, data: { applicantMessage: "New" } })
    render(panel({ status: "rejected", applicantMessage: "Old" }))

    await user.click(screen.getByRole("button", { name: "Edit message" }))
    const box = screen.getByLabelText("Message to the volunteer")
    expect(box).toHaveValue("Old")
    await user.clear(box)
    await user.type(box, "New")
    await user.click(screen.getByRole("dialog").querySelector("button[type=submit]")!)

    await waitFor(() => expect(mockEditMessage).toHaveBeenCalledWith(APP_ID, "New"))
    expect(mockDecide).not.toHaveBeenCalled()
  })
})
