import { beforeEach, describe, expect, it } from "vitest"

import { clearDraft, loadDraft, saveDraft } from "./wizardDraft"

describe("wizardDraft", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns undefined when nothing has been saved yet", () => {
    expect(loadDraft("never-saved")).toBeUndefined()
  })

  it("round-trips values through saveDraft and loadDraft", () => {
    saveDraft("round-trip", [{ name: "Ada" }])
    expect(loadDraft("round-trip")).toEqual([{ name: "Ada" }])
  })

  it("returns undefined for malformed JSON instead of throwing", () => {
    localStorage.setItem("wizard-draft:bad-json", "{not valid json")
    expect(() => loadDraft("bad-json")).not.toThrow()
    expect(loadDraft("bad-json")).toBeUndefined()
  })

  it("clearDraft removes the stored value", () => {
    saveDraft("clear-me", [{ x: 1 }])
    clearDraft("clear-me")
    expect(loadDraft("clear-me")).toBeUndefined()
  })

  it("keeps different formIds in independent storage slots", () => {
    saveDraft("alpha", [{ v: 1 }])
    saveDraft("beta", [{ v: 2 }])
    expect(loadDraft("alpha")).toEqual([{ v: 1 }])
    expect(loadDraft("beta")).toEqual([{ v: 2 }])
  })

  it("is a safe no-op when window is unavailable (simulated server rendering)", () => {
    const originalWindow = globalThis.window

    try {
      // @ts-expect-error - simulating an SSR environment where window does not exist
      delete globalThis.window

      expect(() => saveDraft("ssr-test", [{ a: 1 }])).not.toThrow()
      expect(() => loadDraft("ssr-test")).not.toThrow()
      expect(loadDraft("ssr-test")).toBeUndefined()
      expect(() => clearDraft("ssr-test")).not.toThrow()
    } finally {
      // Restore window even if an assertion above throws, so a failure in
      // this test can't leave window deleted for every later test in this file.
      globalThis.window = originalWindow
    }
  })
})
