import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EventModal } from "./EventModal"

const mockBack = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

describe("EventModal", () => {
  it("opens over the list and goes back to it when closed", async () => {
    const user = userEvent.setup()
    render(
      <EventModal>
        <p>Event body</p>
      </EventModal>
    )

    expect(screen.getByRole("dialog", { name: "Register for Event" })).toBeInTheDocument()
    expect(screen.getByText("Event body")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))

    expect(mockBack).toHaveBeenCalled()
  })
})
