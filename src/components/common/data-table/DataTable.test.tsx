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

  describe("search", () => {
    it("filters rows by any searchable column, case-insensitively", async () => {
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)

      await user.type(screen.getByRole("searchbox", { name: "Search" }), "ALI")
      expect(columnValues(1)).toEqual(["alice"])

      await user.clear(screen.getByRole("searchbox"))
      expect(columnValues(1)).toEqual(["Charlie", "alice", "Bob"])
    })

    it("matches numeric columns too", async () => {
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)
      await user.type(screen.getByRole("searchbox"), "10")
      expect(columnValues(1)).toEqual(["alice"])
    })

    it("shows the empty state when nothing matches", async () => {
      const user = userEvent.setup()
      render(<DataTable data={rows} columns={columns} />)
      await user.type(screen.getByRole("searchbox"), "zzz")
      expect(screen.getByRole("cell", { name: "No records found" })).toBeInTheDocument()
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument()
    })

    it("can be hidden", () => {
      render(<DataTable data={rows} columns={columns} searchable={false} />)
      expect(screen.queryByRole("searchbox")).toBeNull()
    })
  })

  describe("pagination", () => {
    const many: SampleRow[] = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      name: `Person ${String(i + 1).padStart(2, "0")}`,
      count: i,
    }))

    it("shows one page at a time and never leaves valid bounds", async () => {
      const user = userEvent.setup()
      render(<DataTable data={many} columns={columns} pageSize={10} />)
      const prev = screen.getByRole("button", { name: "Previous" })
      const next = screen.getByRole("button", { name: "Next" })

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument()
      expect(columnValues(0)).toHaveLength(10)
      expect(prev).toBeDisabled()

      await user.click(next)
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument()
      expect(columnValues(0)[0]).toBe("11")

      await user.click(next)
      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument()
      expect(columnValues(0)).toEqual(["21", "22", "23", "24", "25"])
      expect(next).toBeDisabled()

      await user.click(prev)
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument()
    })

    it("returns to page 1 when a search narrows the results", async () => {
      const user = userEvent.setup()
      render(<DataTable data={many} columns={columns} pageSize={10} />)

      await user.click(screen.getByRole("button", { name: "Next" }))
      await user.click(screen.getByRole("button", { name: "Next" }))
      await user.type(screen.getByRole("searchbox"), "Person 0")

      // Person 01-09 → one page.
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument()
      expect(columnValues(0)).toHaveLength(9)
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    })

    it("paginates the sorted order, not the original order", async () => {
      const user = userEvent.setup()
      render(<DataTable data={many} columns={columns} pageSize={10} />)
      await user.click(screen.getByRole("button", { name: "Name" })) // asc
      await user.click(screen.getByRole("button", { name: "Name" })) // desc
      expect(columnValues(1)[0]).toBe("Person 25")
    })

    it("disables both controls with an empty data set", () => {
      render(<DataTable data={[]} columns={columns} />)
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    })
  })

  describe("loading", () => {
    it("renders skeleton rows instead of data or the empty state", () => {
      render(<DataTable data={[]} columns={columns} isLoading pageSize={4} />)
      const skeletons = screen.getAllByTestId("data-table-skeleton-row")
      expect(skeletons).toHaveLength(4)
      expect(within(skeletons[0]).getAllByRole("cell")).toHaveLength(columns.length)
      expect(screen.queryByText("No records found")).toBeNull()
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    })

    it("hides real rows while loading", () => {
      render(<DataTable data={rows} columns={columns} isLoading />)
      expect(screen.queryByText("Charlie")).toBeNull()
    })
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
