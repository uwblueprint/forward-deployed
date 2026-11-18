"use client"

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Module scope so the feature set (and row models) stay stable across renders.
export const dataTableFeatures = tableFeatures({
  // Provides `columnVisibility` state, `row.getVisibleCells()` and `table.getVisibleLeafColumns()`.
  columnVisibilityFeature,
  // The filtered row model is owned by column filtering; global search runs through it.
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

// Callers type their columns with this; `any` value type is TanStack's pattern for mixed columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData, any>

const NO_SORTING: SortingState = []
const ALL_VISIBLE: ColumnVisibilityState = {}

type DataTableProps<TData extends RowData> = {
  data: TData[]
  columns: DataTableColumnDef<TData>[]
  initialSorting?: SortingState
  // Column id -> false to hide it; omitted columns stay visible.
  initialColumnVisibility?: ColumnVisibilityState
  // Rows still being fetched: renders one page of skeleton rows instead of data.
  isLoading?: boolean
  // Read at mount, like the other initial* props.
  pageSize?: number
  // Set false to hide the search box (e.g. a short fixed list).
  searchable?: boolean
  searchPlaceholder?: string
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  initialSorting = NO_SORTING,
  initialColumnVisibility = ALL_VISIBLE,
  isLoading = false,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Search",
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    initialState: {
      sorting: initialSorting,
      columnVisibility: initialColumnVisibility,
      globalFilter: "",
      pagination: { pageIndex: 0, pageSize },
    },
    // Click cycles asc -> desc only; no "unsorted" third state.
    enableSortingRemoval: false,
  })

  const rows = table.getRowModel().rows
  const colSpan = table.getVisibleLeafColumns().length
  const { pageIndex, pageSize: currentPageSize } = table.state.pagination
  // Zero matches still reads "Page 1 of 1" rather than "Page 1 of 0".
  const pageCount = Math.max(1, table.getPageCount())
  const pageNumber = Math.min(pageIndex + 1, pageCount)

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={table.state.globalFilter ?? ""}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </InputGroup>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                const label = header.isPlaceholder
                  ? null
                  : <table.FlexRender header={header} />

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-sm font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {label}
                        {sorted === "asc" ? (
                          <ArrowUpIcon aria-hidden="true" className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowUpDownIcon aria-hidden="true" className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody aria-busy={isLoading || undefined}>
          {isLoading ? (
            Array.from({ length: currentPageSize }, (_, i) => (
              <TableRow key={i} data-testid="data-table-skeleton-row">
                {table.getVisibleLeafColumns().map((column) => (
                  <TableCell key={column.id}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              {/* Visible leaf columns, not `columns.length`, so grouped headers still span the full width.
                  Fixed text for now; an `emptyMessage` prop could let each page say e.g.
                  "No volunteers yet." once a page needs it. */}
              <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={isLoading || !table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <span aria-live="polite" className="text-muted-foreground tabular-nums">
          Page {pageNumber} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={isLoading || !table.getCanNextPage()}
        >
          Next
        </Button>
      </nav>
    </div>
  )
}
