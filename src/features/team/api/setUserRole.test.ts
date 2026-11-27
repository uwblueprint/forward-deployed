import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, rpc: mockRpc })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import { setUserRole } from "./setUserRole"

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

const targetId = "11111111-1111-4111-8111-111111111111"

describe("setUserRole", () => {
  it("changes the role on success", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("set_user_role", { target_user_id: targetId, new_role: "manager" })
  })

  it("maps 'You cannot change your own role' to self", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "You cannot change your own role" } })

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "self" })
  })

  it("maps 'User not found in your organization' to not-found", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "User not found in your organization" } })

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "not-found" })
  })

  it("maps 'Only admins can change roles' to forbidden", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only admins can change roles" } })

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "forbidden" })
  })

  it("falls back to backend and logs the error without the target id for an unrecognized message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { code: "XXYYY", message: "Something new" } })

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "backend" })

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), "XXYYY", "Something new")
    const loggedArgs = consoleError.mock.calls.flat()
    expect(loggedArgs.some((arg) => String(arg).includes(targetId))).toBe(false)
    consoleError.mockRestore()
  })

  it("refuses a manager without calling the RPC", async () => {
    mockGetUserRole.mockResolvedValue("manager")

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "forbidden" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("refuses a volunteer without calling the RPC", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "forbidden" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns unauthenticated without calling the RPC when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(setUserRole(targetId, "manager")).resolves.toEqual({ ok: false, reason: "unauthenticated" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects a malformed target id without calling the RPC or adminSession", async () => {
    const result = await setUserRole("not-a-uuid", "manager")

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: "validation" })
    expect((result as { fieldErrors: Record<string, string[]> }).fieldErrors.targetUserId).toBeDefined()
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects an invalid role without calling the RPC or adminSession", async () => {
    const result = await setUserRole(targetId, "owner" as never)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: "validation" })
    expect((result as { fieldErrors: Record<string, string[]> }).fieldErrors.newRole).toBeDefined()
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
