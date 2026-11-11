import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { DataTable, type DataTableColumnDef } from "./DataTable"

type SampleRow = { id: string; name: string; count: number }

const rows: SampleRow[] = [
  { id: "1", name: "Charlie", count: 2 },
  { id: "2", name: "alice", count: 10 },
  { id: "3", name: "Bob", count: 1 },
]

const columns: DataTableColumnDef<SampleRow>[] = [
  { accessorKey: "id", header: "ID", enableSorting: false },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "count", header: "Count" },
]

// Text of a given column for each body row, in rendered order.
function columnValues(index: number) {
  const [, ...bodyRows] = screen.getAllByRole("row")
  return bodyRows.map((r) => within(r).getAllByRole("cell")[index].textContent)
}

describe("DataTable", () => {
  it("renders headers and caller-supplied rows in original order", () => {
    render(<DataTable data={rows} columns={columns} />)
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "ID",
      "Name",
      "Count",
    ])
    expect(columnValues(1)).toEqual(["Charlie", "alice", "Bob"])
  })

  it("sorts strings ascending then descending", async () => {
    const user = userEvent.setup()
    render(<DataTable data={rows} columns={columns} />)
    const header = screen.getByRole("button", { name: "Name" })

    await user.click(header)
    expect(columnValues(1)).toEqual(["alice", "Bob", "Charlie"])
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "ascending"
    )

    await user.click(header)
    expect(columnValues(1)).toEqual(["Charlie", "Bob", "alice"])
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "descending"
    )
  })

  it("sorts numbers numerically (10 after 2), both directions", async () => {
    const user = userEvent.setup()
    render(<DataTable data={rows} columns={columns} />)
    const header = screen.getByRole("button", { name: "Count" })

    // TanStack sorts numeric columns descending first by default.
    await user.click(header)
    expect(columnValues(2)).toEqual(["10", "2", "1"])
    await user.click(header)
    expect(columnValues(2)).toEqual(["1", "2", "10"])
  })

  it("does not make non-sortable columns clickable", () => {
    render(<DataTable data={rows} columns={columns} />)
    expect(screen.queryByRole("button", { name: "ID" })).toBeNull()
  })

  it("shows an empty-state row spanning every column when there is no data", () => {
    render(<DataTable data={[]} columns={columns} />)
    const cell = screen.getByRole("cell", { name: "No records found" })
    expect(cell).toHaveAttribute("colspan", String(columns.length))
    expect(screen.getAllByRole("row")).toHaveLength(2) // header + empty-state row
  })

  it("does not render hidden columns in the header or body", () => {
    render(<DataTable data={rows} columns={columns} initialColumnVisibility={{ id: false }} />)
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Name",
      "Count",
    ])
    expect(columnValues(0)).toEqual(["Charlie", "alice", "Bob"])
    for (const r of screen.getAllByRole("row").slice(1)) {
      expect(within(r).getAllByRole("cell")).toHaveLength(2)
    }
  })

  it("spans only visible columns in the empty state", () => {
    render(<DataTable data={[]} columns={columns} initialColumnVisibility={{ id: false }} />)
    const cell = screen.getByRole("cell", { name: "No records found" })
    expect(cell).toHaveAttribute("colspan", "2")
  })

  it("works with an unrelated row type without changes", async () => {
    type Event = { title: string; date: string }
    const events: Event[] = [
      { title: "Food drive", date: "2026-12-01" },
      { title: "Cleanup", date: "2026-11-15" },
    ]
    const eventColumns: DataTableColumnDef<Event>[] = [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "date", header: "Date" },
    ]
    const user = userEvent.setup()
    render(<DataTable data={events} columns={eventColumns} />)

    await user.click(screen.getByRole("button", { name: "Date" }))
    expect(columnValues(0)).toEqual(["Cleanup", "Food drive"])
  })
})
