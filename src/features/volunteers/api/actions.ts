"use server"

import { submitVolunteerApplication } from "./applications"
import type { VolunteerApplicationResult } from "./applications"
import { getApplicationStatus } from "./applicationStatus"
import type { ApplicationStatus, ApplicationStatusResult } from "./applicationStatus"
import { updateUserName } from "./userName"
import type { UserNameResult } from "./userName"
import { getVolunteerDetails } from "./volunteerDetails"
import type { VolunteerDetails, VolunteerDetailsResult } from "./volunteerDetails"
import { submitVolunteerOnboarding } from "./volunteers"
import type { VolunteerOnboardingResult } from "./volunteers"
import { updateMyVolunteerProfile, updateVolunteerProfile } from "./volunteerProfile"
import type { VolunteerProfileResult } from "./volunteerProfile"
import type { UserName } from "../schemas/volunteerSchema"

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
  responses: unknown = {}
): Promise<VolunteerApplicationResult<{ id: string }>> {
  return submitVolunteerApplication(responses)
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

/**
 * Server Action wrapper so a Client Component can call this directly. Not
 * wired into any profile-edit screen yet - see updateMyVolunteerProfile's
 * doc comment.
 */
export async function updateMyVolunteerProfileAction(
  input: unknown
): Promise<VolunteerProfileResult<{ id: string }>> {
  return updateMyVolunteerProfile(input)
}

/**
 * Server Action wrapper for staff editing a volunteer in their organization,
 * used by the staff profile page. See updateVolunteerProfile's doc comment.
 */
export async function updateVolunteerProfileAction(
  volunteerId: string,
  input: unknown
): Promise<VolunteerProfileResult<{ id: string }>> {
  return updateVolunteerProfile(volunteerId, input)
}

/** Staff-only: one volunteer with their latest application and event history. */
export async function getVolunteerDetailsAction(
  volunteerId: string
): Promise<VolunteerDetailsResult<VolunteerDetails>> {
  return getVolunteerDetails(volunteerId)
}

/** Renames a user: yourself, or anyone in your organization if you're an admin. */
export async function updateUserNameAction(userId: string, input: unknown): Promise<UserNameResult<UserName>> {
  return updateUserName(userId, input)
}
