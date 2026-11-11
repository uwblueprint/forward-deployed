"use client"

import {
  columnVisibilityFeature,
  createSortedRowModel,
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
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Module scope so the feature set (and row models) stay stable across renders.
// Filtering/pagination features get added here later.
export const dataTableFeatures = tableFeatures({
  // Provides `columnVisibility` state, `row.getVisibleCells()` and `table.getVisibleLeafColumns()`.
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
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
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  initialSorting = NO_SORTING,
  initialColumnVisibility = ALL_VISIBLE,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    initialState: { sorting: initialSorting, columnVisibility: initialColumnVisibility },
    // Click cycles asc -> desc only; no "unsorted" third state.
    enableSortingRemoval: false,
  })

  const rows = table.getRowModel().rows

  return (
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
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            {/* Visible leaf columns, not `columns.length`, so grouped headers still span the full width.
                Fixed text for now; an `emptyMessage` prop could let each page say e.g.
                "No volunteers yet." once a page needs it. */}
            <TableCell
              colSpan={table.getVisibleLeafColumns().length}
              className="h-24 text-center text-muted-foreground"
            >
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
  )
}
