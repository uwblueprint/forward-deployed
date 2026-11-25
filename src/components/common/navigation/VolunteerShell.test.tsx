import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_VOLUNTEER_NAV_ITEMS,
  DEFAULT_VOLUNTEER_UTILITY_NAV_ITEMS,
  VolunteerShell,
} from "./VolunteerShell"

const pathname = vi.hoisted(() => ({ current: "/dashboard" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}))

describe("VolunteerShell", () => {
  beforeEach(() => {
    pathname.current = "/dashboard"
  })

  it("links to Dashboard, Events, My events, and Profile", () => {
    render(
      <VolunteerShell>
        <p>Placeholder content</p>
      </VolunteerShell>
    )

    const items = [...DEFAULT_VOLUNTEER_NAV_ITEMS, ...DEFAULT_VOLUNTEER_UTILITY_NAV_ITEMS]
    expect(items.map(({ label, href }) => [label, href])).toEqual([
      ["Dashboard", "/dashboard"],
      ["Events", "/events"],
      ["My events", "/my-events"],
      ["Profile", "/profile"],
    ])
    expect(screen.getByRole("navigation", { name: "Volunteer" })).toBeInTheDocument()
    for (const item of items) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href)
    }
    expect(screen.getByRole("main")).toHaveTextContent("Placeholder content")
  })

  it("marks the current route link and titles the header with it", () => {
    render(<VolunteerShell>x</VolunteerShell>)
    expect(screen.getByRole("banner")).toHaveTextContent("Dashboard")
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Events" })).not.toHaveAttribute("aria-current")
  })

  it("keeps a section active on nested routes without matching look-alike paths", () => {
    pathname.current = "/events/123"
    render(<VolunteerShell>x</VolunteerShell>)
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "My events" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("banner")).toHaveTextContent("Events")
  })

  it("marks the Profile utility link active on /profile", () => {
    pathname.current = "/profile"
    render(<VolunteerShell>x</VolunteerShell>)
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current")
  })

  it("renders the account slot in the sidebar footer", () => {
    render(<VolunteerShell account={<p>Account probe</p>}>x</VolunteerShell>)
    expect(screen.getByText("Account probe")).toBeInTheDocument()
  })

  it("hides the desktop sidebar entirely when collapsed (offcanvas, no icon rail)", async () => {
    const user = userEvent.setup()
    render(<VolunteerShell>x</VolunteerShell>)

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" })
    const sidebar = document.getElementById(toggle.getAttribute("aria-controls")!)!
    expect(sidebar).not.toHaveClass("invisible")

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(sidebar).toHaveClass("invisible", "w-0")
    expect(sidebar).toHaveAttribute("data-collapsed", "false")
  })

  it("opens the mobile drawer from the header's trailing menu button", async () => {
    const user = userEvent.setup()
    render(<VolunteerShell>x</VolunteerShell>)

    const open = screen.getByRole("button", { name: "Open navigation" })
    expect(open).toHaveClass("ml-auto")
    await user.click(open)
    expect(open).toHaveAttribute("aria-expanded", "true")
    const drawer = await screen.findByRole("dialog")
    expect(drawer).toHaveTextContent("My events")
  })
})
