"use client"

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
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
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

// Callers type their columns with this; `any` value type is TanStack's pattern for mixed columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData, any>

const NO_SORTING: SortingState = []

type FilterableDataTableProps<TData extends RowData> = {
  data: TData[]
  columns: DataTableColumnDef<TData>[]
  initialSorting?: SortingState
}

export function FilterableDataTable<TData extends RowData>({
  data,
  columns,
  initialSorting = NO_SORTING,
}: FilterableDataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    initialState: { sorting: initialSorting },
    // Click cycles asc -> desc only; no "unsorted" third state.
    enableSortingRemoval: false,
  })

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
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
