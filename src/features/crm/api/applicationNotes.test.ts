import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockUpdate, mockInsert, mockDelete, updates } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
  updates: [] as unknown[],
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== "application_notes") throw new Error(`unexpected table: ${table}`)
      return {
        update: (values: unknown) => {
          updates.push(values)
          return { eq: () => ({ select: mockUpdate }) }
        },
        insert: mockInsert,
        delete: () => ({ eq: mockDelete }),
      }
    },
  })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import { saveApplicationNote } from "./applicationNotes"

const APP_ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"

beforeEach(() => {
  vi.resetAllMocks()
  updates.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

describe("saveApplicationNote", () => {
  it("updates an existing note", async () => {
    mockUpdate.mockResolvedValue({ data: [{ internal_note: "Checked references" }], error: null })

    await expect(saveApplicationNote(APP_ID, "  Checked references ")).resolves.toEqual({
      ok: true,
      data: { note: "Checked references" },
    })
    expect(updates).toEqual([{ internal_note: "Checked references" }])
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("inserts the first note", async () => {
    mockUpdate.mockResolvedValue({ data: [], error: null })
    mockInsert.mockResolvedValue({ error: null })

    await expect(saveApplicationNote(APP_ID, "First note")).resolves.toEqual({ ok: true, data: { note: "First note" } })
    expect(mockInsert).toHaveBeenCalledWith({ application_id: APP_ID, internal_note: "First note" })
  })

  it("updates instead when another admin inserted first", async () => {
    mockUpdate
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ internal_note: "Mine" }], error: null })
    mockInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate" } })

    await expect(saveApplicationNote(APP_ID, "Mine")).resolves.toEqual({ ok: true, data: { note: "Mine" } })
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it("refuses a manager before touching notes, even to clear one", async () => {
    mockGetUserRole.mockResolvedValue("manager")

    await expect(saveApplicationNote(APP_ID, "x")).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
    await expect(saveApplicationNote(APP_ID, "")).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("refuses an admin the database refuses (their own application)", async () => {
    mockUpdate.mockResolvedValue({ data: [], error: null })
    mockInsert.mockResolvedValue({ error: { code: "42501", message: "row-level security" } })

    await expect(saveApplicationNote(APP_ID, "x")).resolves.toEqual({ ok: false, error: { type: "not-allowed" } })
  })

  it("removes the note when it's blank", async () => {
    mockDelete.mockResolvedValue({ error: null })

    await expect(saveApplicationNote(APP_ID, "   ")).resolves.toEqual({ ok: true, data: { note: null } })
    expect(mockDelete).toHaveBeenCalledWith("application_id", APP_ID)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(saveApplicationNote(APP_ID, "x")).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("rejects bad input before touching the database", async () => {
    await expect(saveApplicationNote("nope", "x".repeat(5001))).resolves.toMatchObject({
      ok: false,
      error: { type: "validation", fieldErrors: { applicationId: expect.any(Array), note: expect.any(Array) } },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns database errors as backend errors", async () => {
    mockUpdate.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(saveApplicationNote(APP_ID, "x")).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})
