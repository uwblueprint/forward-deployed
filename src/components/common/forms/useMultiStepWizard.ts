"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ZodError, ZodType } from "zod"

import { loadDraft, saveDraft } from "./wizardDraft"

export interface UseMultiStepWizardOptions {
  /** Total number of steps in the wizard. Must be a positive integer. */
  totalSteps: number
  /** Step to start on, clamped into bounds. Defaults to 0. */
  initialStep?: number
  /**
   * When provided, step values are persisted to localStorage under this key
   * and restored on mount. Omit to opt out of draft persistence entirely.
   */
  formId?: string
  /**
   * Optional ordered Zod schema per step, used to validate that step's data
   * before `next()` is allowed to advance. A missing entry (including a
   * shorter array than totalSteps) means that step has no validation gate.
   */
  stepSchemas?: ReadonlyArray<ZodType<unknown> | undefined>
  /** Seed values for each step, used before any saved draft is restored. */
  initialValues?: unknown[]
}

/**
 * Result of a next() call: the validated (and, if the schema coerces or
 * trims, transformed) data for the step that was just checked, or a failure
 * marker. Mirrors ZodSafeParseResult's shape so callers who already know
 * Zod's safeParse don't need to learn a second convention.
 */
export type WizardAdvanceResult = { success: true; data: unknown } | { success: false }

export interface UseMultiStepWizardResult {
  /** Zero-based index of the step currently being shown. */
  currentStepIndex: number
  /** Whether the current step is the first step (index 0). */
  isFirstStep: boolean
  /** Whether the current step is the last step (index totalSteps - 1). */
  isLastStep: boolean
  /** Total number of steps the wizard was configured with. */
  totalSteps: number
  /**
   * Validate the active step's data and, if it passes, persist it and
   * advance. No-ops at the last step. Sets `errors` and does not advance
   * when validation fails. Returns the validated step data on success so a
   * caller - e.g. a "Submit" handler on the last step - never needs to
   * re-validate the same data itself to know what was just accepted.
   */
  next: () => WizardAdvanceResult
  /** Go back to the previous step. No-ops when already on the first step. */
  prev: () => void
  /** Jump directly to a step index, bypassing validation. Ignored when out of bounds. */
  goToStep: (index: number) => void
  /** Return to the initial step and clear any active-step errors. */
  reset: () => void
  /** Current values for every step, indexed by step. */
  values: unknown[]
  /** Replace the stored value for a single step. Ignored when out of bounds. */
  setStepValue: (index: number, value: unknown) => void
  /** Field path -> message for the active step's last failed validation, or null. */
  errors: Record<string, string> | null
}

function clampToBounds(index: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0
  if (index < 0) return 0
  if (index > totalSteps - 1) return totalSteps - 1
  return index
}

function isValidStepIndex(index: number, totalSteps: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= totalSteps - 1
}

function defaultValues(totalSteps: number): unknown[] {
  return Array.from({ length: totalSteps }, () => ({}))
}

function toErrorMap(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form"
    if (!(key in errors)) {
      errors[key] = issue.message
    }
  }
  return errors
}

/**
 * Headless step-navigation state for a multi-step wizard/form.
 *
 * Tracks the current step index plus (optionally) per-step values, Zod
 * validation gates, and a localStorage-backed draft keyed by `formId`.
 * Deliberately has no knowledge of visual styling, database entities, or
 * authentication — those are layered on by the consuming component.
 */
export function useMultiStepWizard({
  totalSteps,
  initialStep = 0,
  formId,
  stepSchemas,
  initialValues,
}: UseMultiStepWizardOptions): UseMultiStepWizardResult {
  const [currentStepIndex, setCurrentStepIndex] = useState(() =>
    clampToBounds(initialStep, totalSteps)
  )
  const [values, setValues] = useState<unknown[]>(
    () => initialValues ?? defaultValues(totalSteps)
  )
  const [errors, setErrors] = useState<Record<string, string> | null>(null)

  // Mirrors `values`, but updated synchronously (not deferred like setState)
  // so logic that runs later in the same tick - e.g. a "Next" click handler
  // calling setStepValue() immediately followed by next() - always sees the
  // latest data instead of whatever `values` happened to be on the last
  // render. See commitValues().
  const valuesRef = useRef(values)

  // Writes a new values array to both the ref (read synchronously by
  // setStepValue/next) and React state (read by consumers for rendering),
  // then persists it as the draft. The single choke point for every write
  // keeps the two copies from ever drifting apart.
  const commitValues = useCallback(
    (nextValues: unknown[]) => {
      valuesRef.current = nextValues
      setValues(nextValues)
      if (formId) saveDraft(formId, nextValues)
    },
    [formId]
  )

  // Restore a saved draft after mount only, never during server rendering or
  // the initial (pre-hydration) client render, so SSR output always matches
  // the hydrated DOM on first paint. localStorage cannot be read safely
  // during render (it doesn't exist on the server), so this one-time,
  // bounded setState-after-mount is the standard hydration-safe pattern for
  // syncing in external client-only storage - not the unbounded
  // render-loop case the set-state-in-effect rule guards against.
  useEffect(() => {
    if (!formId) return
    const draft = loadDraft<unknown[]>(formId)
    if (Array.isArray(draft)) {
      valuesRef.current = draft
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(draft)
    }
  }, [formId])

  const setStepValue = useCallback(
    (index: number, value: unknown) => {
      if (!isValidStepIndex(index, totalSteps)) return
      const nextValues = [...valuesRef.current]
      nextValues[index] = value
      commitValues(nextValues)
      // Editing the step that's currently showing errors clears them rather
      // than leaving a stale message on screen next to data that may
      // already be fixed. They'll be recomputed fresh the next time next()
      // runs - this is a simplification (it clears the whole step's errors,
      // not just the field that changed), traded for not needing to track
      // which individual fields are dirty.
      if (index === currentStepIndex) {
        setErrors(null)
      }
    },
    [commitValues, currentStepIndex, totalSteps]
  )

  const goToStep = useCallback(
    (index: number) => {
      if (!isValidStepIndex(index, totalSteps)) return
      setErrors(null)
      setCurrentStepIndex(index)
    },
    [totalSteps]
  )

  const next = useCallback((): WizardAdvanceResult => {
    const activeValues = valuesRef.current
    const schema = stepSchemas?.[currentStepIndex]
    let dataForStep = activeValues[currentStepIndex]

    if (schema) {
      const result = schema.safeParse(dataForStep)
      if (!result.success) {
        setErrors(toErrorMap(result.error))
        return { success: false }
      }

      setErrors(null)
      dataForStep = result.data
      const nextValues = [...activeValues]
      nextValues[currentStepIndex] = result.data
      commitValues(nextValues)
    } else {
      setErrors(null)
    }

    setCurrentStepIndex((current) => clampToBounds(current + 1, totalSteps))
    return { success: true, data: dataForStep }
  }, [commitValues, currentStepIndex, stepSchemas, totalSteps])

  const prev = useCallback(() => {
    setErrors(null)
    setCurrentStepIndex((current) => clampToBounds(current - 1, totalSteps))
  }, [totalSteps])

  const reset = useCallback(() => {
    setErrors(null)
    setCurrentStepIndex(clampToBounds(initialStep, totalSteps))
  }, [initialStep, totalSteps])

  return {
    currentStepIndex,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === totalSteps - 1,
    totalSteps,
    next,
    prev,
    goToStep,
    reset,
    values,
    setStepValue,
    errors,
  }
}
