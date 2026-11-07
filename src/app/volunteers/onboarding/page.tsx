import { Suspense } from "react"

import { VolunteerOnboardingWizard } from "@/features/volunteers"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * first_name/last_name are collected at registration (#19) and read here
 * only to display read-only in the wizard - this page isn't auth-gated yet,
 * so a signed-out visit just renders the wizard with a blank display name.
 *
 * Reads cookies() (via the Supabase client) and can't be statically
 * prerendered, so it's isolated in its own component behind <Suspense>,
 * same pattern as RequireSession/VolunteerDashboard elsewhere in the app.
 */
async function OnboardingWizardWithDisplayName() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let firstName = ""
  let lastName = ""
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()
    firstName = profile?.first_name ?? ""
    lastName = profile?.last_name ?? ""
  }

  return <VolunteerOnboardingWizard displayFirstName={firstName} displayLastName={lastName} />
}

export default function VolunteerOnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Volunteer onboarding</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Unstyled structure for review - navigation, validation, and draft recovery only. Visual
        design comes later. Submitting requires a signed-in session; this page isn&apos;t
        auth-gated yet.
      </p>
      <div className="mt-8">
        <Suspense>
          <OnboardingWizardWithDisplayName />
        </Suspense>
      </div>
    </div>
  )
}
