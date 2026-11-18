"use client"

import { DataTable, type DataTableColumnDef } from "@/components/common/data-table"
import type { VolunteerWithUser, Weekday } from "@/lib/adapters"

export type VolunteerListProps = {
  volunteers: VolunteerWithUser[]
}

// Fixed locale and zone so server and client render the same text.
const joinedFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" })

const WEEKDAY_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

function fullName({ user }: VolunteerWithUser) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ")
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Structural columns only; visual treatment waits on the CRM designs.
const columns: DataTableColumnDef<VolunteerWithUser>[] = [
  { id: "name", header: "Name", accessorFn: (v) => fullName(v) || "—" },
  { id: "email", header: "Email", accessorFn: (v) => v.user?.email ?? "—" },
  { id: "status", header: "Status", accessorFn: (v) => capitalize(v.status) },
  { id: "location", header: "Location", accessorFn: (v) => v.location ?? "—" },
  {
    id: "availability",
    header: "Availability",
    enableSorting: false,
    accessorFn: (v) =>
      WEEKDAY_ORDER.filter((day) => v.availability_days.includes(day))
        .map((day) => capitalize(day.slice(0, 3)))
        .join(", ") || "—",
  },
  {
    id: "skills",
    header: "Skills",
    enableSorting: false,
    accessorFn: (v) => v.skills.join(", ") || "—",
  },
  {
    // ISO strings sort chronologically; the cell shows a readable date.
    id: "joined",
    header: "Joined",
    accessorKey: "created_at",
    cell: ({ getValue }) => joinedFormat.format(new Date(getValue<string>())),
  },
]

export function VolunteerList({ volunteers }: VolunteerListProps) {
  return <DataTable data={volunteers} columns={columns} initialSorting={[{ id: "name", desc: false }]} />
}
