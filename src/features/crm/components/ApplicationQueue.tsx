"use client"

import Link from "next/link"

import { DataTable, type DataTableColumnDef } from "@/components/common/data-table"

import type { ApplicationSummary } from "../api/applicationReview"
import { ApplicationStatusBadge } from "./ApplicationStatusBadge"
import { formatDate, fullName } from "./format"

export type ApplicationQueueProps = {
  applications: ApplicationSummary[]
}

const STATUS_RANK = { pending: 0, rejected: 1, approved: 2 } as const

const columns: DataTableColumnDef<ApplicationSummary>[] = [
  {
    id: "name",
    header: "Applicant",
    accessorFn: (a) => fullName(a.applicant) || a.applicant?.email || "Unknown applicant",
    cell: ({ row, getValue }) => (
      <Link href={`/admin/applications/${row.original.id}`} className="font-medium underline-offset-4 hover:underline">
        {getValue<string>()}
      </Link>
    ),
  },
  { id: "email", header: "Email", accessorFn: (a) => a.applicant?.email ?? "—" },
  {
    id: "status",
    header: "Status",
    accessorFn: (a) => STATUS_RANK[a.status],
    cell: ({ row }) => <ApplicationStatusBadge status={row.original.status} />,
  },
  {
    // ISO strings sort chronologically; the cell shows a readable date.
    id: "submitted",
    header: "Submitted",
    accessorKey: "submittedAt",
    cell: ({ getValue }) => formatDate(getValue<string>()),
  },
  {
    id: "reviewed",
    header: "Reviewed",
    accessorFn: (a) => a.reviewedAt ?? "",
    cell: ({ row }) => formatDate(row.original.reviewedAt),
  },
]

/** The review queue. Rows arrive pending first; the column headers re-sort them. */
export function ApplicationQueue({ applications }: ApplicationQueueProps) {
  return <DataTable data={applications} columns={columns} searchPlaceholder="Search applicants" />
}
