import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getUserRole, requireRole } from "@/features/auth"
import { getVolunteerDetailsAction, VolunteerProfile } from "@/features/volunteers"

async function Volunteer({ id }: { id: string }) {
  // Pages render alongside the layout, so the layout's check doesn't gate this fetch.
  const user = await requireRole(["admin", "manager"])

  const [role, result] = await Promise.all([getUserRole(user), getVolunteerDetailsAction(id)])
  if (!result.ok) {
    // requireRole already handled signed-out and non-staff callers.
    if (result.error.type !== "backend") notFound()
    console.error("Failed to load volunteer", result.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load this volunteer</AlertTitle>
        <AlertDescription>Refresh the page to try again.</AlertDescription>
      </Alert>
    )
  }

  // Only admins rename other people (FOR-65); anyone can rename themselves.
  const canRename = role === "admin" || result.data.volunteer.user_id === user.id

  return <VolunteerProfile details={result.data} canRename={canRename} />
}

export default function VolunteerProfilePage({ params }: PageProps<"/admin/volunteers/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading volunteer…</p>}>
      {params.then(({ id }) => (
        <Volunteer id={id} />
      ))}
    </Suspense>
  )
}
