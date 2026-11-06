import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearDraft, loadDraft, saveDraft } from "./wizardDraft"

describe("wizardDraft", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    // Safety net: each fake-timer test restores real timers itself in a
    // finally block, but this catches it if one of them ever doesn't.
    vi.useRealTimers()
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

  it("treats a draft older than the TTL as expired, and clears it", () => {
    vi.useFakeTimers()
    try {
      const start = new Date("2026-01-01T00:00:00.000Z")
      vi.setSystemTime(start)
      saveDraft("stale", [{ name: "Ada" }])

      // Just under 24h later: still valid.
      vi.setSystemTime(new Date(start.getTime() + 23 * 60 * 60 * 1000))
      expect(loadDraft("stale")).toEqual([{ name: "Ada" }])

      // Just over 24h later: expired.
      vi.setSystemTime(new Date(start.getTime() + 24 * 60 * 60 * 1000 + 1))
      expect(loadDraft("stale")).toBeUndefined()

      // Expiry actively clears it, not just hides it on this one read.
      vi.setSystemTime(new Date(start.getTime()))
      expect(loadDraft("stale")).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it("accepts a custom ttlMs", () => {
    vi.useFakeTimers()
    try {
      const start = new Date("2026-01-01T00:00:00.000Z")
      vi.setSystemTime(start)
      saveDraft("short-lived", [{ name: "Ada" }])

      vi.setSystemTime(new Date(start.getTime() + 1000 * 60 * 10)) // +10 minutes
      expect(loadDraft("short-lived", 1000 * 60 * 5)).toBeUndefined() // 5-minute TTL
    } finally {
      vi.useRealTimers()
    }
  })

  it("treats a pre-TTL draft shape (no savedAt wrapper) as absent rather than throwing", () => {
    localStorage.setItem("wizard-draft:old-shape", JSON.stringify([{ name: "Ada" }]))
    expect(() => loadDraft("old-shape")).not.toThrow()
    expect(loadDraft("old-shape")).toBeUndefined()
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
