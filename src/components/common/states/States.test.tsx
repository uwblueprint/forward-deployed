import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CalendarIcon } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { EmptyState, ErrorState, LoadingState } from "."

describe("LoadingState", () => {
  it("announces a status with a default label", () => {
    render(<LoadingState />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading")
  })

  it("accepts a custom label and row count", () => {
    const { container } = render(<LoadingState label="Loading events" rows={5} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading events")
    // 2 heading skeletons + 5 rows.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(7)
  })
})

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="No upcoming events"
        description="Events you register for will show up here."
        action={<button type="button">Find events</button>}
      />
    )
    expect(screen.getByRole("heading", { level: 2, name: "No upcoming events" })).toBeInTheDocument()
    expect(screen.getByText("Events you register for will show up here.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Find events" })).toBeInTheDocument()
  })

  it("supports a custom heading level and icon, or no icon", () => {
    const { container, rerender } = render(
      <EmptyState title="Nothing here" titleAs="h1" icon={CalendarIcon} />
    )
    expect(screen.getByRole("heading", { level: 1, name: "Nothing here" })).toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeNull()

    rerender(<EmptyState title="Nothing here" icon={null} />)
    expect(container.querySelector("svg")).toBeNull()
  })
})

describe("ErrorState", () => {
  it("shows friendly default copy as an alert", () => {
    render(<ErrorState />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent("We couldn't load this page. Please try again.")
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("calls onRetry from the Try again button", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("accepts custom copy and an extra action", () => {
    render(
      <ErrorState
        title="Couldn't load your events"
        description="Check your connection."
        retryLabel="Reload"
        onRetry={() => {}}
        action={<a href="/dashboard">Go to dashboard</a>}
      />
    )
    expect(screen.getByRole("heading", { name: "Couldn't load your events" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toBeInTheDocument()
  })
})
