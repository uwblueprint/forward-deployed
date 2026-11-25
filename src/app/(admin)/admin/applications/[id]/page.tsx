import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requireRole } from "@/features/auth"
import { ApplicationDetail, getApplicationReview } from "@/features/crm"

async function Application({ id }: { id: string }) {
  await requireRole(["admin", "manager"])

  const result = await getApplicationReview(id)
  if (!result.ok) {
    if (result.error.type === "not-found") notFound()
    console.error("Failed to load application", result.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load this application</AlertTitle>
        <AlertDescription>Refresh the page to try again.</AlertDescription>
      </Alert>
    )
  }

  return <ApplicationDetail application={result.data} />
}

export default function AdminApplicationPage({ params }: PageProps<"/admin/applications/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading application…</p>}>
      {params.then(({ id }) => (
        <Application id={id} />
      ))}
    </Suspense>
  )
}
