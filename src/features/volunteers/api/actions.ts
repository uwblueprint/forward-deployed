"use server"

import { deleteDraft, loadDraft, saveDraft } from "./applicationDrafts"
import type { ApplicationDraft, ApplicationDraftResult } from "./applicationDrafts"
import { submitVolunteerApplication } from "./applications"
import type { VolunteerApplicationResult } from "./applications"
import { getApplicationStatus } from "./applicationStatus"
import type { ApplicationStatus, ApplicationStatusResult } from "./applicationStatus"
import { submitVolunteerOnboarding } from "./volunteers"
import type { VolunteerOnboardingResult } from "./volunteers"
import { updateMyVolunteerProfile, updateVolunteerProfile } from "./volunteerProfile"
import type { VolunteerProfileResult } from "./volunteerProfile"

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
 * Server Action wrappers so a Client Component can call these directly. Not
 * wired into the onboarding wizard's existing localStorage draft yet - see
 * applicationDrafts.ts's doc comment.
 */
export async function saveDraftAction(responses: unknown): Promise<ApplicationDraftResult<null>> {
  return saveDraft(responses)
}

export async function loadDraftAction(): Promise<ApplicationDraftResult<ApplicationDraft | null>> {
  return loadDraft()
}

export async function deleteDraftAction(): Promise<ApplicationDraftResult<null>> {
  return deleteDraft()
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
 * Server Action wrapper for staff editing a volunteer in their organization.
 * Not wired into any admin screen yet - see updateVolunteerProfile's doc
 * comment.
 */
export async function updateVolunteerProfileAction(
  volunteerId: string,
  input: unknown
): Promise<VolunteerProfileResult<{ id: string }>> {
  return updateVolunteerProfile(volunteerId, input)
}
