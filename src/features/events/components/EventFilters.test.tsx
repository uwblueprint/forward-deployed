import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EMPTY_EVENT_FILTERS } from "../utils/eventFilters"
import { EventFilters } from "./EventFilters"

const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/events",
}))

const categories = ["Environment", "Food security"]
const locations = ["Sunny Beach, Oceanfront Park", "Town Square, 456 Music Way"]

function renderFilters(values = EMPTY_EVENT_FILTERS) {
  return render(<EventFilters values={values} categories={categories} locations={locations} />)
}

beforeEach(() => {
  mockReplace.mockReset()
})

describe("EventFilters", () => {
  it("searches by name after the user stops typing", async () => {
    const user = userEvent.setup()
    renderFilters()

    await user.type(screen.getByRole("searchbox", { name: "Search events by name" }), "beach")

    await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/events?q=beach", { scroll: false }))
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it("keeps newer typing when an older search response lands", async () => {
    const user = userEvent.setup()
    const { rerender } = renderFilters()
    const box = screen.getByRole("searchbox", { name: "Search events by name" })

    await user.type(box, "a")
    await vi.waitFor(() => expect(mockReplace).toHaveBeenLastCalledWith("/events?q=a", { scroll: false }))
    await user.type(box, "b")
    await vi.waitFor(() => expect(mockReplace).toHaveBeenLastCalledWith("/events?q=ab", { scroll: false }))

    // The slow "a" response arrives after "ab" was sent: the box must keep "ab".
    rerender(<EventFilters values={{ ...EMPTY_EVENT_FILTERS, q: "a" }} categories={categories} locations={locations} />)
    expect(box).toHaveValue("ab")
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(mockReplace).toHaveBeenLastCalledWith("/events?q=ab", { scroll: false })

    // A URL change we never made (back/forward) still updates the box.
    rerender(<EventFilters values={{ ...EMPTY_EVENT_FILTERS, q: "lake" }} categories={categories} locations={locations} />)
    expect(box).toHaveValue("lake")
  })

  it("filters by category, keeping the other filters", async () => {
    const user = userEvent.setup()
    renderFilters({ ...EMPTY_EVENT_FILTERS, q: "beach" })

    await user.click(screen.getByRole("combobox", { name: "Category" }))
    await user.click(await screen.findByRole("option", { name: "Environment" }))

    expect(mockReplace).toHaveBeenCalledWith("/events?q=beach&category=Environment", { scroll: false })
  })

  it("filters by a known location or a typed one", async () => {
    const user = userEvent.setup()
    renderFilters()

    await user.click(screen.getByRole("button", { name: "Location" }))
    await user.type(await screen.findByRole("textbox", { name: "Search locations" }), "sunny")
    expect(screen.queryByRole("button", { name: "Town Square, 456 Music Way" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sunny Beach, Oceanfront Park" }))

    expect(mockReplace).toHaveBeenLastCalledWith("/events?location=Sunny+Beach%2C+Oceanfront+Park", {
      scroll: false,
    })

    // The trigger shows the chosen location right away, before the page reloads.
    await user.click(screen.getByRole("button", { name: "Sunny Beach, Oceanfront Park" }))
    await user.type(await screen.findByRole("textbox", { name: "Search locations" }), "Kitchener{Enter}")

    expect(mockReplace).toHaveBeenLastCalledWith("/events?location=Kitchener", { scroll: false })
  })

  it("filters by date range", async () => {
    const user = userEvent.setup()
    renderFilters()

    await user.click(screen.getByRole("button", { name: "Date" }))
    fireEvent.change(await screen.findByLabelText("From"), { target: { value: "2026-11-20" } })

    expect(mockReplace).toHaveBeenCalledWith("/events?from=2026-11-20", { scroll: false })
  })

  it("keeps earlier changes when filters change faster than the page reloads", async () => {
    const user = userEvent.setup()
    const { rerender } = renderFilters()

    await user.click(screen.getByRole("button", { name: "Date" }))
    fireEvent.change(await screen.findByLabelText("From"), { target: { value: "2026-11-20" } })
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-22" } })

    expect(mockReplace).toHaveBeenLastCalledWith("/events?from=2026-11-20&to=2026-11-22", { scroll: false })

    // The first navigation's props land while the second is still pending.
    rerender(
      <EventFilters
        values={{ ...EMPTY_EVENT_FILTERS, from: "2026-11-20" }}
        categories={categories}
        locations={locations}
      />
    )
    expect(screen.getByLabelText("To")).toHaveValue("2026-11-22")
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-21" } })

    expect(mockReplace).toHaveBeenLastCalledWith("/events?from=2026-11-21&to=2026-11-22", { scroll: false })
  })

  it("shows the active filters and clears them all", async () => {
    const user = userEvent.setup()
    renderFilters({ q: "beach", category: "Environment", location: "Waterloo", from: "2026-11-20", to: "2026-11-22" })

    expect(screen.getByRole("searchbox", { name: "Search events by name" })).toHaveValue("beach")
    expect(screen.getByRole("button", { name: "Nov 20 – Nov 22" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Waterloo" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear filters" }))

    expect(mockReplace).toHaveBeenCalledWith("/events", { scroll: false })
    expect(screen.getByRole("searchbox", { name: "Search events by name" })).toHaveValue("")
  })
})
