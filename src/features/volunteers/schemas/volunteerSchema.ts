import { z } from "zod"

/**
 * Independently composable Zod schemas for the volunteer onboarding wizard.
 *
 * The five field groups below are the smallest composable units. The three
 * step schemas compose them into the step boundaries the wizard currently
 * uses. Both the units and the step groupings are provisional and expected
 * to shift as the onboarding hi-fi design evolves - nothing here depends on
 * generated database row types, so regrouping never forces a form-engine
 * rewrite.
 */

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export const SHIFTS = ["morning", "afternoon", "evening"] as const

const weekdayEnum = z.enum(WEEKDAYS, "Pick a valid weekday")
const shiftEnum = z.enum(SHIFTS, "Pick a shift preference")

// Permissive on purpose: digits plus common separators, 7-20 characters.
// Real-world phone formatting varies too much to validate more strictly
// without a dedicated phone-number library.
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/

// --- Five independent field groups -----------------------------------------

export const personalDetailsSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120, "Full name is too long"),
  email: z.email("Enter a valid email address"),
  phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
  location: z.string().trim().min(1, "Location is required"),
})

export const availabilitySchema = z.object({
  weekdays: z.array(weekdayEnum).min(1, "Select at least one day you're available"),
  shiftPreference: shiftEnum,
})

export const skillsSchema = z.object({
  skills: z.array(z.string().trim().min(1)).min(1, "Select or enter at least one skill"),
})

export const emergencyContactSchema = z.object({
  emergencyContactName: z.string().trim().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
  emergencyContactRelationship: z
    .string()
    .trim()
    .min(1, "Relationship to emergency contact is required"),
})

export const consentSchema = z.object({
  agreedToTerms: z.literal(true, { message: "You must accept the terms to continue" }),
})

// --- Three composed steps ----------------------------------------------------
// Step boundaries are provisional; each step is just a merge of whichever
// field groups currently belong together, so the grouping can change later
// without touching the units themselves.

export const stepOneSchema = personalDetailsSchema
export const stepTwoSchema = availabilitySchema
export const stepThreeSchema = skillsSchema.merge(emergencyContactSchema).merge(consentSchema)

/** Ordered step schemas, ready to pass directly as useMultiStepWizard's `stepSchemas`. */
export const volunteerOnboardingStepSchemas = [stepOneSchema, stepTwoSchema, stepThreeSchema] as const

/** The full, combined payload across all three steps. */
export const volunteerOnboardingSchema = stepOneSchema.merge(stepTwoSchema).merge(stepThreeSchema)

// --- Form-input types (never generated database row types) -------------------

export type PersonalDetails = z.infer<typeof personalDetailsSchema>
export type Availability = z.infer<typeof availabilitySchema>
export type Skills = z.infer<typeof skillsSchema>
export type EmergencyContact = z.infer<typeof emergencyContactSchema>
export type Consent = z.infer<typeof consentSchema>

export type VolunteerOnboardingStepOne = z.infer<typeof stepOneSchema>
export type VolunteerOnboardingStepTwo = z.infer<typeof stepTwoSchema>
export type VolunteerOnboardingStepThree = z.infer<typeof stepThreeSchema>

export type VolunteerOnboardingPayload = z.infer<typeof volunteerOnboardingSchema>
