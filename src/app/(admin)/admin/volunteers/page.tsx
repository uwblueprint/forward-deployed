import { Suspense } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requireRole } from "@/features/auth"
import { VolunteerList } from "@/features/volunteers"
import { volunteerRepo, type VolunteerWithUser } from "@/lib/adapters"

async function Volunteers() {
  // Pages render alongside the layout, so the layout's check doesn't gate this fetch.
  // RLS still scopes rows to the admin's organization.
  await requireRole(["admin", "manager"])

  let volunteers: VolunteerWithUser[]
  try {
    volunteers = await volunteerRepo.getAllWithUser()
  } catch (error) {
    console.error("Failed to load volunteers", error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load volunteers</AlertTitle>
        <AlertDescription>Refresh the page to try again.</AlertDescription>
      </Alert>
    )
  }

  return <VolunteerList volunteers={volunteers} />
}

export default function AdminVolunteersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
        <p className="text-sm text-muted-foreground">
          Volunteer profiles, applications, and event assignments.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading volunteers…</p>}>
        <Volunteers />
      </Suspense>
    </div>
  )
}
