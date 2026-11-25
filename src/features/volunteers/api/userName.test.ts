import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockFrom, mockUpdate, mockEq, mockMaybeSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockFrom: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockMaybeSingle: vi.fn(),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation((table: string) => {
      if (table !== "users") throw new Error(`unexpected table: ${table}`)
      return {
        update: mockUpdate.mockImplementation(() => ({
          eq: mockEq.mockImplementation(() => ({ select: () => ({ maybeSingle: mockMaybeSingle }) })),
        })),
      }
    }),
  })),
}))

import { updateUserName } from "./userName"

const SELF = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const OTHER = "11111111-2222-4333-8444-555555555555"

function signedIn(role: "admin" | "manager" | "volunteer") {
  mockGetUser.mockResolvedValue({ data: { user: { id: SELF } } })
  mockGetUserRole.mockResolvedValue(role)
}

function saves(firstName: string, lastName: string) {
  mockMaybeSingle.mockResolvedValue({ data: { first_name: firstName, last_name: lastName }, error: null })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("updateUserName", () => {
  it("lets an admin rename someone in their organization", async () => {
    signedIn("admin")
    saves("Sam", "Lee")

    await expect(updateUserName(OTHER, { firstName: " Sam ", lastName: "Lee" })).resolves.toEqual({
      ok: true,
      data: { firstName: "Sam", lastName: "Lee" },
    })
    expect(mockUpdate).toHaveBeenCalledWith({ first_name: "Sam", last_name: "Lee" })
    expect(mockEq).toHaveBeenCalledWith("id", OTHER)
  })

  it("lets anyone rename themselves", async () => {
    signedIn("volunteer")
    saves("Ana", "Diaz")

    await expect(updateUserName(SELF, { firstName: "Ana", lastName: "Diaz" })).resolves.toMatchObject({ ok: true })
    expect(mockGetUserRole).not.toHaveBeenCalled()
  })

  it("stops a manager renaming someone else", async () => {
    signedIn("manager")

    await expect(updateUserName(OTHER, { firstName: "Sam", lastName: "Lee" })).resolves.toEqual({
      ok: false,
      error: { type: "forbidden" },
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns not-found when RLS hides the user", async () => {
    signedIn("admin")
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(updateUserName(OTHER, { firstName: "Sam", lastName: "Lee" })).resolves.toEqual({
      ok: false,
      error: { type: "not-found" },
    })
  })

  it("returns not-found for a malformed id", async () => {
    signedIn("admin")

    await expect(updateUserName("not-an-id", { firstName: "Sam", lastName: "Lee" })).resolves.toEqual({
      ok: false,
      error: { type: "not-found" },
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("rejects blank names before touching the database", async () => {
    const result = await updateUserName(OTHER, { firstName: "  ", lastName: "" })

    expect(result).toMatchObject({
      ok: false,
      error: { type: "validation", fieldErrors: { firstName: expect.any(Array), lastName: expect.any(Array) } },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(updateUserName(OTHER, { firstName: "Sam", lastName: "Lee" })).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("returns backend errors", async () => {
    signedIn("admin")
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } })

    await expect(updateUserName(OTHER, { firstName: "Sam", lastName: "Lee" })).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })
})
