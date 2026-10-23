import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"

import { useMultiStepWizard } from "./useMultiStepWizard"
import { loadDraft } from "./wizardDraft"

describe("useMultiStepWizard", () => {
  it("initializes at step 0 by default with correct derived flags", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 3 }))

    expect(result.current.currentStepIndex).toBe(0)
    expect(result.current.totalSteps).toBe(3)
    expect(result.current.isFirstStep).toBe(true)
    expect(result.current.isLastStep).toBe(false)
  })

  it("clamps an out-of-range initialStep into bounds", () => {
    const { result: tooHigh } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 3, initialStep: 99 })
    )
    expect(tooHigh.current.currentStepIndex).toBe(2)

    const { result: tooLow } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 3, initialStep: -5 })
    )
    expect(tooLow.current.currentStepIndex).toBe(0)
  })

  it("advances forward with next() and updates isLastStep", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 3 }))

    act(() => result.current.next())
    expect(result.current.currentStepIndex).toBe(1)
    expect(result.current.isFirstStep).toBe(false)
    expect(result.current.isLastStep).toBe(false)

    act(() => result.current.next())
    expect(result.current.currentStepIndex).toBe(2)
    expect(result.current.isLastStep).toBe(true)
  })

  it("does not advance past the last step", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2 }))

    act(() => result.current.next())
    expect(result.current.currentStepIndex).toBe(1)

    act(() => result.current.next())
    expect(result.current.currentStepIndex).toBe(1)
    expect(result.current.isLastStep).toBe(true)
  })

  it("rewinds with prev() and does not retreat before the first step", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 3, initialStep: 1 }))

    act(() => result.current.prev())
    expect(result.current.currentStepIndex).toBe(0)

    act(() => result.current.prev())
    expect(result.current.currentStepIndex).toBe(0)
    expect(result.current.isFirstStep).toBe(true)
  })

  it("goToStep jumps to a valid index", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 4 }))

    act(() => result.current.goToStep(2))
    expect(result.current.currentStepIndex).toBe(2)
  })

  it("goToStep ignores out-of-bounds and non-integer indices", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 3 }))

    act(() => result.current.goToStep(1))
    expect(result.current.currentStepIndex).toBe(1)

    act(() => result.current.goToStep(99))
    expect(result.current.currentStepIndex).toBe(1)

    act(() => result.current.goToStep(-1))
    expect(result.current.currentStepIndex).toBe(1)

    act(() => result.current.goToStep(1.5))
    expect(result.current.currentStepIndex).toBe(1)
  })

  it("reset() returns to the initial step after navigation", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 4, initialStep: 1 }))

    act(() => result.current.goToStep(3))
    expect(result.current.currentStepIndex).toBe(3)

    act(() => result.current.reset())
    expect(result.current.currentStepIndex).toBe(1)
  })

  it("setStepValue ignores out-of-bounds and non-integer indices", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2 }))

    act(() => result.current.setStepValue(99, { name: "nope" }))
    expect(result.current.values).toEqual([{}, {}])

    act(() => result.current.setStepValue(-1, { name: "nope" }))
    expect(result.current.values).toEqual([{}, {}])

    act(() => result.current.setStepValue(1.5, { name: "nope" }))
    expect(result.current.values).toEqual([{}, {}])
  })
})

describe("useMultiStepWizard - validation gates", () => {
  const stepSchemas = [
    z.object({ name: z.string().min(1, "Name is required") }),
    z.object({ age: z.number().min(18, "Must be at least 18") }),
  ]

  it("blocks next() and exposes descriptive errors when active-step data is invalid", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => result.current.setStepValue(0, { name: "" }))
    act(() => result.current.next())

    expect(result.current.currentStepIndex).toBe(0)
    expect(result.current.errors).toEqual({ name: "Name is required" })
  })

  it("advances and clears errors once active-step data is valid", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => result.current.setStepValue(0, { name: "Ada" }))
    act(() => result.current.next())

    expect(result.current.currentStepIndex).toBe(1)
    expect(result.current.errors).toBeNull()
  })

  it("clears stale errors from a previous step when navigating away", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => result.current.setStepValue(0, { name: "" }))
    act(() => result.current.next())
    expect(result.current.errors).not.toBeNull()

    act(() => result.current.goToStep(1))
    expect(result.current.errors).toBeNull()
  })

  it("clears errors as soon as the active step's value is edited, before next() re-validates", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => result.current.setStepValue(0, { name: "" }))
    act(() => result.current.next())
    expect(result.current.errors).not.toBeNull()

    // The user starts fixing it - still technically invalid (one character),
    // but the stale error from the previous attempt shouldn't linger next to
    // data the user is actively changing.
    act(() => result.current.setStepValue(0, { name: "A" }))
    expect(result.current.errors).toBeNull()
  })

  it("does not clear errors when editing a step other than the one currently showing them", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => result.current.setStepValue(0, { name: "" }))
    act(() => result.current.next())
    expect(result.current.errors).not.toBeNull()

    // Editing a different step's value shouldn't touch the errors being
    // shown for the step the user is actually looking at.
    act(() => result.current.setStepValue(1, { age: 30 }))
    expect(result.current.errors).not.toBeNull()
  })

  it("advances without validation on steps that have no schema", () => {
    const { result } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 2, stepSchemas: [undefined, stepSchemas[1]] })
    )

    act(() => result.current.next())
    expect(result.current.currentStepIndex).toBe(1)
    expect(result.current.errors).toBeNull()
  })

  it("next() returns the validated (and schema-transformed) data on success", () => {
    const trimmingSchema = [z.object({ name: z.string().trim().min(1, "Name is required") })]
    const { result } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 1, stepSchemas: trimmingSchema })
    )

    act(() => result.current.setStepValue(0, { name: "  Ada  " }))

    let outcome: ReturnType<typeof result.current.next> | undefined
    act(() => {
      outcome = result.current.next()
    })

    // A caller shouldn't need to re-parse the data to know what was just
    // accepted - this should be the schema's own (trimmed) output.
    expect(outcome).toEqual({ success: true, data: { name: "Ada" } })
  })

  it("next() returns success: false without advancing when validation fails", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    let outcome: ReturnType<typeof result.current.next> | undefined
    act(() => {
      outcome = result.current.next()
    })

    expect(outcome).toEqual({ success: false })
    expect(result.current.currentStepIndex).toBe(0)
  })

  it("next() returns the raw value as success on a step with no schema", () => {
    const { result } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 2, stepSchemas: [undefined, stepSchemas[1]] })
    )
    act(() => result.current.setStepValue(0, { anything: "goes" }))

    let outcome: ReturnType<typeof result.current.next> | undefined
    act(() => {
      outcome = result.current.next()
    })

    expect(outcome).toEqual({ success: true, data: { anything: "goes" } })
  })

  it("validates the value from setStepValue even when next() is called in the same handler", () => {
    // Simulates a real "Next" button handler that sets the freshly-typed
    // value and immediately asks to advance in one synchronous call, with
    // no separate render in between - the scenario a stale closure would
    // get wrong.
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => {
      result.current.setStepValue(0, { name: "Ada" })
      result.current.next()
    })

    expect(result.current.currentStepIndex).toBe(1)
    expect(result.current.errors).toBeNull()
    expect(result.current.values[0]).toEqual({ name: "Ada" })
  })

  it("blocks advancing when the value set in that same handler is invalid", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, stepSchemas }))

    act(() => {
      result.current.setStepValue(0, { name: "" })
      result.current.next()
    })

    expect(result.current.currentStepIndex).toBe(0)
    expect(result.current.errors).toEqual({ name: "Name is required" })
  })
})

describe("useMultiStepWizard - draft persistence", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("persists step values to localStorage keyed by formId", () => {
    const { result } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 2, formId: "volunteer-onboarding" })
    )

    act(() => result.current.setStepValue(0, { name: "Ada" }))

    expect(loadDraft("volunteer-onboarding")).toEqual([{ name: "Ada" }, {}])
  })

  it("restores saved values for the matching formId on a fresh mount (simulated reload)", () => {
    const { result: before, unmount } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 2, formId: "restore-test" })
    )
    act(() => before.current.setStepValue(0, { name: "Grace" }))
    unmount()

    const { result: after } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 2, formId: "restore-test" })
    )

    expect(after.current.values).toEqual([{ name: "Grace" }, {}])
  })

  it("keeps drafts for different formIds independent", () => {
    const { result: formA } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 1, formId: "form-a" })
    )
    const { result: formB } = renderHook(() =>
      useMultiStepWizard({ totalSteps: 1, formId: "form-b" })
    )

    act(() => formA.current.setStepValue(0, { value: "a" }))
    act(() => formB.current.setStepValue(0, { value: "b" }))

    expect(loadDraft("form-a")).toEqual([{ value: "a" }])
    expect(loadDraft("form-b")).toEqual([{ value: "b" }])
  })

  it("ignores a malformed draft and falls back to default values", () => {
    localStorage.setItem("wizard-draft:broken", "{not valid json")

    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 2, formId: "broken" }))

    expect(result.current.values).toEqual([{}, {}])
  })

  it("does not persist anything when no formId is given", () => {
    const { result } = renderHook(() => useMultiStepWizard({ totalSteps: 1 }))

    act(() => result.current.setStepValue(0, { name: "No draft" }))

    expect(loadDraft("undefined")).toBeUndefined()
  })
})
