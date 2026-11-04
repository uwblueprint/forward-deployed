import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AdminShell, DEFAULT_ADMIN_NAV_ITEMS } from "./AdminShell"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}))

describe("AdminShell", () => {
  it("renders nav links and children in the main area", () => {
    render(
      <AdminShell>
        <p>Placeholder content</p>
      </AdminShell>
    )

    const nav = screen.getByRole("navigation", { name: "Admin" })
    for (const item of DEFAULT_ADMIN_NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href
      )
    }
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveTextContent("Placeholder content")
  })

  it("marks the current route link", () => {
    render(<AdminShell>x</AdminShell>)
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Events" })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("accepts custom nav items", () => {
    render(
      <AdminShell navItems={[{ label: "Reports", href: "/admin/reports" }]}>
        x
      </AdminShell>
    )
    expect(screen.getByRole("link", { name: "Reports" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull()
  })

  it("toggles the desktop sidebar by click and keyboard", async () => {
    const user = userEvent.setup()
    render(<AdminShell>x</AdminShell>)

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle).toHaveAccessibleName("Expand sidebar")

    toggle.focus()
    await user.keyboard("{Enter}")
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    await user.keyboard(" ")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("opens and closes the mobile drawer", async () => {
    const user = userEvent.setup()
    render(<AdminShell>x</AdminShell>)

    const open = screen.getByRole("button", { name: "Open navigation" })
    expect(open).toHaveAttribute("aria-expanded", "false")

    await user.click(open)
    expect(open).toHaveAttribute("aria-expanded", "true")

    await user.click(screen.getByRole("button", { name: "Close navigation" }))
    expect(open).toHaveAttribute("aria-expanded", "false")
  })

  it("keeps children mounted across toggles (no remount / layout reset)", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell>
        <input aria-label="probe" defaultValue="" />
      </AdminShell>
    )
    const input = screen.getByLabelText("probe")
    await user.type(input, "kept")
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(screen.getByLabelText("probe")).toBe(input)
    expect(input).toHaveValue("kept")
  })
})
