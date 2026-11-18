import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockFrom, mockVolunteerMaybeSingle, mockUpsert, mockLoadMaybeSingle, mockDelete } = vi.hoisted(
  () => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockVolunteerMaybeSingle: vi.fn(),
    mockUpsert: vi.fn(),
    mockLoadMaybeSingle: vi.fn(),
    mockDelete: vi.fn(),
  })
)

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ maybeSingle: mockVolunteerMaybeSingle }) }) }
      }
      if (table === "application_drafts") {
        return {
          upsert: mockUpsert,
          select: () => ({ maybeSingle: mockLoadMaybeSingle }),
          delete: mockDelete,
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }),
  })),
}))

import { deleteDraft, loadDraft, saveDraft } from "./applicationDrafts"

const user = { id: "user-1", email: "person@example.com" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("saveDraft", () => {
  it("returns a validation error when responses isn't a plain object", async () => {
    const result = await saveDraft("not an object")

    expect(result).toEqual({
      ok: false,
      error: { type: "validation", message: "Draft responses must be a JSON object" },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects an array, even though arrays are technically JSON", async () => {
    const result = await saveDraft(["not", "an", "object"])

    expect(result.ok).toBe(false)
  })

  it("rejects a Map/Set/Date - JSON.stringify would silently discard its data", async () => {
    await expect(saveDraft(new Map([["a", 1]]))).resolves.toMatchObject({ ok: false })
    await expect(saveDraft(new Set([1, 2]))).resolves.toMatchObject({ ok: false })
    await expect(saveDraft(new Date())).resolves.toMatchObject({ ok: false })
  })

  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(saveDraft({ phone: "555-0100" })).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns no-profile when the caller has no volunteer profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(saveDraft({ phone: "555-0100" })).resolves.toEqual({
      ok: false,
      error: { type: "no-profile" },
    })
  })

  it("upserts the draft keyed by the caller's own volunteer_id, accepting a partial payload", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockUpsert.mockResolvedValue({ error: null })

    const result = await saveDraft({ phone: "555-0100" })

    expect(result).toEqual({ ok: true, data: null })
    expect(mockUpsert).toHaveBeenCalledWith(
      { volunteer_id: "volunteer-1", responses: { phone: "555-0100" } },
      { onConflict: "volunteer_id" }
    )
  })

  it("returns a backend error on upsert failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockVolunteerMaybeSingle.mockResolvedValue({ data: { id: "volunteer-1" }, error: null })
    mockUpsert.mockResolvedValue({ error: { message: "boom" } })

    await expect(saveDraft({})).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })
})

describe("loadDraft", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(loadDraft()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
    expect(mockFrom).not.toHaveBeenCalledWith("application_drafts")
  })

  it("returns null when the caller has no saved draft - relying on RLS, with no volunteer lookup", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockLoadMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(loadDraft()).resolves.toEqual({ ok: true, data: null })
    expect(mockFrom).not.toHaveBeenCalledWith("volunteers")
  })

  it("returns the caller's own draft", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockLoadMaybeSingle.mockResolvedValue({
      data: { responses: { phone: "555-0100" }, updated_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    })

    await expect(loadDraft()).resolves.toEqual({
      ok: true,
      data: { responses: { phone: "555-0100" }, updatedAt: "2026-01-01T00:00:00.000Z" },
    })
  })

  it("returns a backend error on query failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockLoadMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } })

    await expect(loadDraft()).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })
})

describe("deleteDraft", () => {
  it("returns unauthenticated when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(deleteDraft()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
    expect(mockFrom).not.toHaveBeenCalledWith("application_drafts")
  })

  it("deletes the caller's own draft with no filter, relying on RLS, and no volunteer lookup", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockDelete.mockResolvedValue({ error: null })

    await expect(deleteDraft()).resolves.toEqual({ ok: true, data: null })
    expect(mockDelete).toHaveBeenCalledWith()
    expect(mockFrom).not.toHaveBeenCalledWith("volunteers")
  })

  it("succeeds even if no draft existed", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockDelete.mockResolvedValue({ error: null })

    await expect(deleteDraft()).resolves.toEqual({ ok: true, data: null })
  })

  it("returns a backend error on delete failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockDelete.mockResolvedValue({ error: { message: "boom" } })

    await expect(deleteDraft()).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })
})
