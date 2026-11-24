import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import VolunteerError from "./error"

describe("volunteer error boundary", () => {
  it("shows the shared ErrorState, never the raw error message, and retries", async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<VolunteerError error={new Error("relation volunteers does not exist")} retry={retry} />)

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong")
    expect(screen.queryByText(/relation volunteers/)).toBeNull()
    expect(consoleError).toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
