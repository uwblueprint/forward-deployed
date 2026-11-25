import { Suspense } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/features/auth"
import { CustomQuestionsEditor, OrganizationSettingsForm, getSettings } from "@/features/settings"

async function OrganizationSettings() {
  // Pages render alongside the layout, so the layout's check doesn't gate this fetch.
  await requireRole("admin")

  const result = await getSettings()
  if (!result.ok) {
    console.error("Failed to load settings", result.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load settings</AlertTitle>
        <AlertDescription>Refresh the page to try again.</AlertDescription>
      </Alert>
    )
  }

  const { organization, applicationQuestions, registrationQuestions } = result.data

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Your organization&apos;s name and the lists staff and volunteers pick from.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationSettingsForm organization={organization} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application questions</CardTitle>
          <CardDescription>Asked when someone applies to volunteer.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomQuestionsEditor entityType="application" questions={applicationQuestions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event signup questions</CardTitle>
          <CardDescription>Asked when a volunteer signs up for an event.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomQuestionsEditor entityType="registration" questions={registrationQuestions} />
        </CardContent>
      </Card>
    </>
  )
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <OrganizationSettings />
    </Suspense>
  )
}
