import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }))

async function loadAdapters(dataSource: string | undefined) {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", dataSource)
  return import(".")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("data source switch", () => {
  it("serves the mocks when NEXT_PUBLIC_DATA_SOURCE=mock", async () => {
    const adapters = await loadAdapters("mock")
    const { MockEventRepository, MockVolunteerRepository } = await import("./mock")
    expect(adapters.dataSource).toBe("mock")
    expect(adapters.volunteerRepo).toBeInstanceOf(MockVolunteerRepository)
    expect(adapters.eventRepo).toBeInstanceOf(MockEventRepository)
  })

  it("serves Supabase when NEXT_PUBLIC_DATA_SOURCE=supabase", async () => {
    const adapters = await loadAdapters("supabase")
    const { SupabaseEventRepository, SupabaseVolunteerRepository } = await import("./supabase")
    expect(adapters.dataSource).toBe("supabase")
    expect(adapters.volunteerRepo).toBeInstanceOf(SupabaseVolunteerRepository)
    expect(adapters.eventRepo).toBeInstanceOf(SupabaseEventRepository)
  })

  it("defaults to Supabase", async () => {
    const adapters = await loadAdapters(undefined)
    expect(adapters.dataSource).toBe("supabase")
  })
})
