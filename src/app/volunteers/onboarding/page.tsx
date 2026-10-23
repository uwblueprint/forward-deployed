import { VolunteerOnboardingWizard } from "@/features/volunteers"

export default function VolunteerOnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Volunteer onboarding</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Unstyled structure for review - navigation, validation, and draft recovery only. Visual
        design comes later.
      </p>
      <div className="mt-8">
        <VolunteerOnboardingWizard />
      </div>
    </div>
  )
}
