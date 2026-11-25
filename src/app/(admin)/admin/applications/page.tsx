import { Suspense } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requireRole } from "@/features/auth"
import { ApplicationQueue, listApplications } from "@/features/crm"

async function Applications() {
  // Pages render alongside the layout, so the layout's check doesn't gate this fetch.
  await requireRole(["admin", "manager"])

  const result = await listApplications()
  if (!result.ok) {
    console.error("Failed to load applications", result.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load applications</AlertTitle>
        <AlertDescription>Refresh the page to try again.</AlertDescription>
      </Alert>
    )
  }

  return <ApplicationQueue applications={result.data} />
}

export default function AdminApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Each volunteer&apos;s latest application, pending first.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading applications…</p>}>
        <Applications />
      </Suspense>
    </div>
  )
}
