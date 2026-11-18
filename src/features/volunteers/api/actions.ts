"use server"

import { submitVolunteerApplication } from "./applications"
import type { VolunteerApplicationResult } from "./applications"
import { getApplicationStatus } from "./applicationStatus"
import type { ApplicationStatus, ApplicationStatusResult } from "./applicationStatus"
import { submitVolunteerOnboarding } from "./volunteers"
import type { VolunteerOnboardingResult } from "./volunteers"

/** Server Action wrapper so the Client Component form can call this directly. */
export async function submitVolunteerOnboardingAction(
  input: unknown
): Promise<VolunteerOnboardingResult<null>> {
  return submitVolunteerOnboarding(input)
}

/**
 * Server Action wrapper so a Client Component can call this directly. Not
 * wired into the onboarding wizard yet - see submitVolunteerApplication's
 * doc comment.
 */
export async function submitVolunteerApplicationAction(
  input: unknown
): Promise<VolunteerApplicationResult<{ id: string }>> {
  return submitVolunteerApplication(input)
}

/**
 * Server Action wrapper so a Client Component can call this directly. Not
 * wired into any status screen yet - see getApplicationStatus's doc comment.
 */
export async function getApplicationStatusAction(): Promise<
  ApplicationStatusResult<ApplicationStatus | null>
> {
  return getApplicationStatus()
}
