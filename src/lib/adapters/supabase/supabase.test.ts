import { describe, expect, it, vi } from "vitest"
import type { ClientFactory } from "."
import { SupabaseEventRepository, SupabaseVolunteerRepository } from "."

/** A fake client whose query chains resolve to `result`, recording each call. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: [string, unknown[]][] = []
  // Only the query is awaitable, like supabase-js; the client itself isn't.
  const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => resolve(result) }
  for (const method of ["select", "insert", "update", "eq", "order", "single", "maybeSingle"]) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, args])
      return query
    }
  }
  const client = {
    from: (...args: unknown[]) => {
      calls.push(["from", args])
      return query
    },
  }
  const factory = vi.fn(async () => client) as unknown as ClientFactory
  return { factory, calls }
}

describe("SupabaseVolunteerRepository", () => {
  it("gets a volunteer by id, or null when RLS hides it", async () => {
    const { factory, calls } = fakeClient({ data: null, error: null })
    await expect(new SupabaseVolunteerRepository(factory).getById("v1")).resolves.toBeNull()
    expect(calls).toEqual([["from", ["volunteers"]], ["select", []], ["eq", ["id", "v1"]], ["maybeSingle", []]])
  })

  it("throws the database error", async () => {
    const error = new Error("permission denied")
    const { factory } = fakeClient({ data: null, error })
    await expect(new SupabaseVolunteerRepository(factory).update("v1", { phone: "x" })).rejects.toBe(error)
  })
})

describe("SupabaseEventRepository", () => {
  it("asks for the computed registration_count", async () => {
    const { factory, calls } = fakeClient({ data: [], error: null })
    await new SupabaseEventRepository(factory).getAll()
    expect(calls).toContainEqual(["select", ["*, registration_count"]])
  })

  it("reports no registrations for a new event", async () => {
    const { factory } = fakeClient({ data: { id: "e1", registration_count: null }, error: null })
    const event = await new SupabaseEventRepository(factory).create({
      organization_id: "o1",
      title: "New",
      starts_at: "2027-01-01T09:00:00.000Z",
      ends_at: "2027-01-01T10:00:00.000Z",
    })
    expect(event.registration_count).toBe(0)
  })
})
