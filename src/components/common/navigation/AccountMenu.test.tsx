import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AccountMenu } from "./AccountMenu"

const replace = vi.fn()
const refresh = vi.fn()
const signOut = vi.fn().mockResolvedValue({ ok: true, data: null })

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}))

describe("AccountMenu", () => {
  it("shows initials, name, and email", () => {
    render(<AccountMenu name="Famay Wuong" email="fwuong@uwblueprint.org" onSignOut={signOut} />)
    expect(screen.getByText("FW")).toBeInTheDocument()
    expect(screen.getByText("Famay Wuong")).toBeInTheDocument()
    expect(screen.getByText("fwuong@uwblueprint.org")).toBeInTheDocument()
  })

  it("signs out and sends the user to /login", async () => {
    const user = userEvent.setup()
    render(<AccountMenu name="Famay Wuong" email="fwuong@uwblueprint.org" onSignOut={signOut} />)

    await user.click(screen.getByRole("button", { name: "Account menu for Famay Wuong" }))
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"))
    expect(signOut).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it("stays on the page when sign-out fails", async () => {
    const user = userEvent.setup()
    replace.mockClear()
    signOut.mockResolvedValueOnce({ ok: false })
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<AccountMenu name="Famay Wuong" email="fwuong@uwblueprint.org" onSignOut={signOut} />)

    await user.click(screen.getByRole("button", { name: "Account menu for Famay Wuong" }))
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }))

    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(replace).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
