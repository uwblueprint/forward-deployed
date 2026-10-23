"use client"

import { useState } from "react"

import { clearDraft, useMultiStepWizard } from "@/components/common/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  SHIFTS,
  WEEKDAYS,
  volunteerOnboardingStepSchemas,
  type Availability,
  type PersonalDetails,
  type VolunteerOnboardingPayload,
  type VolunteerOnboardingStepThree,
} from "../schemas/volunteerSchema"

/** Draft storage key. Fixed per-form, not per-user - no auth in this lane. */
const FORM_ID = "volunteer-onboarding"

/**
 * Placeholder skill options for the unstyled structure built in this ticket.
 * The schema itself only requires a non-empty string array - this fixed
 * list is a UI-only stand-in until Flora's hi-fi defines the real taxonomy.
 */
const SKILL_OPTIONS = [
  "First aid",
  "Event setup",
  "Driving",
  "Translation",
  "Mentoring",
  "Fundraising",
] as const

/**
 * Step 3's in-progress draft shape. `VolunteerOnboardingStepThree` (the
 * schema's inferred output type) types `agreedToTerms` as the literal
 * `true`, because that's the only value a *valid* payload can hold - but
 * the draft being actively edited must be able to represent "not yet
 * agreed" as `false` too, before the user checks the box. Validation still
 * goes through the real `stepThreeSchema`; only the in-progress draft's
 * type is widened here.
 */
type StepThreeDraft = Omit<Partial<VolunteerOnboardingStepThree>, "agreedToTerms"> & {
  agreedToTerms?: boolean
}

/**
 * Empty-but-present defaults for every field, keyed by step. Zod checks a
 * field's base type before its `.min()`/`.length()` refinements, so an
 * untouched `undefined` field fails with a generic "expected string,
 * received undefined" instead of our descriptive message - seeding real
 * empty values (`""`, `[]`) up front means every validation error a user
 * sees is the friendly one defined in volunteerSchema.ts.
 */
const INITIAL_STEP_VALUES: unknown[] = [
  { fullName: "", email: "", phone: "", location: "" },
  { weekdays: [], shiftPreference: "" },
  {
    skills: [],
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    agreedToTerms: false,
  },
]

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

function errorId(name: string): string {
  return `${name}-error`
}

/**
 * Independent three-step volunteer onboarding form.
 *
 * Unstyled structure only (bare primitives, minimal layout) - navigation,
 * validation, and draft persistence come from useMultiStepWizard; field
 * shapes come from the volunteer schemas. No database or auth dependency.
 */
export function VolunteerOnboardingWizard() {
  const wizard = useMultiStepWizard({
    totalSteps: 3,
    formId: FORM_ID,
    stepSchemas: volunteerOnboardingStepSchemas,
    initialValues: INITIAL_STEP_VALUES,
  })
  const [submittedPayload, setSubmittedPayload] = useState<VolunteerOnboardingPayload | null>(
    null
  )

  const personalDetails = (wizard.values[0] ?? {}) as Partial<PersonalDetails>
  const availability = (wizard.values[1] ?? {}) as Partial<Availability>
  const stepThree = (wizard.values[2] ?? {}) as StepThreeDraft

  function fieldError(name: string): string | undefined {
    return wizard.errors?.[name]
  }

  /** The id of a field's error message, only when it currently has one - so aria-describedby never points at an absent element. */
  function describedBy(name: string): string | undefined {
    return fieldError(name) ? errorId(name) : undefined
  }

  function updatePersonalDetails(patch: Partial<PersonalDetails>) {
    wizard.setStepValue(0, { ...personalDetails, ...patch })
  }

  function updateAvailability(patch: Partial<Availability>) {
    wizard.setStepValue(1, { ...availability, ...patch })
  }

  function updateStepThree(patch: Partial<StepThreeDraft>) {
    wizard.setStepValue(2, { ...stepThree, ...patch })
  }

  function toggleWeekday(day: (typeof WEEKDAYS)[number]) {
    const current = availability.weekdays ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    updateAvailability({ weekdays: next })
  }

  function toggleSkill(skill: string) {
    const current = stepThree.skills ?? []
    const next = current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]
    updateStepThree({ skills: next })
  }

  function handleSubmitStep() {
    const result = wizard.next()
    if (!wizard.isLastStep || !result.success) return

    // result.data is next()'s own validated (and schema-transformed) step 3
    // output - using it directly means this never has to re-run stepThreeSchema
    // itself and risk disagreeing with what the hook just accepted.
    const payload: VolunteerOnboardingPayload = {
      ...(personalDetails as PersonalDetails),
      ...(availability as Availability),
      ...(result.data as VolunteerOnboardingStepThree),
    }

    console.log("Volunteer onboarding submitted:", payload)
    clearDraft(FORM_ID)
    setSubmittedPayload(payload)
  }

  if (submittedPayload) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <h2 className="text-lg font-semibold">You&apos;re all set!</h2>
        <p className="text-sm text-muted-foreground">
          Thanks for signing up to volunteer. Here&apos;s what we recorded:
        </p>
        <pre className="overflow-auto rounded-lg border border-border bg-muted p-3 text-xs">
          {JSON.stringify(submittedPayload, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmitStep()
      }}
      className="flex max-w-md flex-col gap-6"
    >
      <p className="text-sm text-muted-foreground">
        Step {wizard.currentStepIndex + 1} of {wizard.totalSteps}
      </p>

      {wizard.currentStepIndex === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={personalDetails.fullName ?? ""}
              onChange={(event) => updatePersonalDetails({ fullName: event.target.value })}
              aria-invalid={Boolean(fieldError("fullName"))}
              aria-describedby={describedBy("fullName")}
            />
            <FieldError id={errorId("fullName")} message={fieldError("fullName")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={personalDetails.email ?? ""}
              onChange={(event) => updatePersonalDetails({ email: event.target.value })}
              aria-invalid={Boolean(fieldError("email"))}
              aria-describedby={describedBy("email")}
            />
            <FieldError id={errorId("email")} message={fieldError("email")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={personalDetails.phone ?? ""}
              onChange={(event) => updatePersonalDetails({ phone: event.target.value })}
              aria-invalid={Boolean(fieldError("phone"))}
              aria-describedby={describedBy("phone")}
            />
            <FieldError id={errorId("phone")} message={fieldError("phone")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={personalDetails.location ?? ""}
              onChange={(event) => updatePersonalDetails({ location: event.target.value })}
              aria-invalid={Boolean(fieldError("location"))}
              aria-describedby={describedBy("location")}
            />
            <FieldError id={errorId("location")} message={fieldError("location")} />
          </div>
        </div>
      )}

      {wizard.currentStepIndex === 1 && (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Available weekdays</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-1.5 text-sm capitalize">
                  <input
                    type="checkbox"
                    checked={availability.weekdays?.includes(day) ?? false}
                    onChange={() => toggleWeekday(day)}
                    aria-describedby={describedBy("weekdays")}
                  />
                  {day}
                </label>
              ))}
            </div>
            <FieldError id={errorId("weekdays")} message={fieldError("weekdays")} />
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shiftPreference">Shift preference</Label>
            <Select
              value={availability.shiftPreference ?? ""}
              onValueChange={(value) =>
                updateAvailability({ shiftPreference: value as Availability["shiftPreference"] })
              }
            >
              <SelectTrigger
                id="shiftPreference"
                className="w-full"
                aria-describedby={describedBy("shiftPreference")}
              >
                <SelectValue placeholder="Pick a shift" />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((shift) => (
                  <SelectItem key={shift} value={shift} className="capitalize">
                    {shift}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={errorId("shiftPreference")} message={fieldError("shiftPreference")} />
          </div>
        </div>
      )}

      {wizard.currentStepIndex === 2 && (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Skills</legend>
            <div className="flex flex-wrap gap-3">
              {SKILL_OPTIONS.map((skill) => (
                <label key={skill} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={stepThree.skills?.includes(skill) ?? false}
                    onChange={() => toggleSkill(skill)}
                    aria-describedby={describedBy("skills")}
                  />
                  {skill}
                </label>
              ))}
            </div>
            <FieldError id={errorId("skills")} message={fieldError("skills")} />
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emergencyContactName">Emergency contact name</Label>
            <Input
              id="emergencyContactName"
              value={stepThree.emergencyContactName ?? ""}
              onChange={(event) =>
                updateStepThree({ emergencyContactName: event.target.value })
              }
              aria-invalid={Boolean(fieldError("emergencyContactName"))}
              aria-describedby={describedBy("emergencyContactName")}
            />
            <FieldError
              id={errorId("emergencyContactName")}
              message={fieldError("emergencyContactName")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
            <Input
              id="emergencyContactPhone"
              type="tel"
              value={stepThree.emergencyContactPhone ?? ""}
              onChange={(event) =>
                updateStepThree({ emergencyContactPhone: event.target.value })
              }
              aria-invalid={Boolean(fieldError("emergencyContactPhone"))}
              aria-describedby={describedBy("emergencyContactPhone")}
            />
            <FieldError
              id={errorId("emergencyContactPhone")}
              message={fieldError("emergencyContactPhone")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
              value={stepThree.emergencyContactRelationship ?? ""}
              onChange={(event) =>
                updateStepThree({ emergencyContactRelationship: event.target.value })
              }
              aria-invalid={Boolean(fieldError("emergencyContactRelationship"))}
              aria-describedby={describedBy("emergencyContactRelationship")}
            />
            <FieldError
              id={errorId("emergencyContactRelationship")}
              message={fieldError("emergencyContactRelationship")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stepThree.agreedToTerms === true}
              onChange={(event) => updateStepThree({ agreedToTerms: event.target.checked })}
              aria-invalid={Boolean(fieldError("agreedToTerms"))}
              aria-describedby={describedBy("agreedToTerms")}
            />
            I agree to the volunteer terms and conditions
          </label>
          <FieldError id={errorId("agreedToTerms")} message={fieldError("agreedToTerms")} />
        </div>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={wizard.prev} disabled={wizard.isFirstStep}>
          Back
        </Button>
        <Button type="submit">{wizard.isLastStep ? "Submit" : "Next"}</Button>
      </div>
    </form>
  )
}
