"use server"

import { submitVolunteerOnboarding } from "./volunteers"
import type { VolunteerOnboardingResult } from "./volunteers"

/** Server Action wrapper so the Client Component form can call this directly. */
export async function submitVolunteerOnboardingAction(
  input: unknown
): Promise<VolunteerOnboardingResult<null>> {
  return submitVolunteerOnboarding(input)
}
