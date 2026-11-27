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

import { createInvitation } from "./createInvitation"

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

describe("createInvitation", () => {
  it("returns the invitation id and a relative invite path on success", async () => {
    mockRpc.mockResolvedValue({ data: [{ invitation_id: "inv-1", token: "raw-token" }], error: null })

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({
      ok: true,
      invitationId: "inv-1",
      invitePath: "/auth/invite?token=raw-token",
    })
    expect(mockRpc).toHaveBeenCalledWith("create_invitation", { invitee_email: "new@example.com", invitee_role: "volunteer" })
  })

  it("url-encodes special characters in the token", async () => {
    mockRpc.mockResolvedValue({ data: [{ invitation_id: "inv-1", token: "a+b&c" }], error: null })

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({
      ok: true,
      invitationId: "inv-1",
      invitePath: `/auth/invite?token=${encodeURIComponent("a+b&c")}`,
    })
  })

  it("maps 'That person is already a member' to already-member", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "23505", message: "That person is already a member" } })

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "already-member" })
  })

  it("maps 'Only admins can invite people' to forbidden", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only admins can invite people" } })

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "forbidden" })
  })

  it("falls back to backend and logs the error without the email for an unrecognized message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { code: "XXYYY", message: "Something new" } })

    await expect(createInvitation("secret@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "backend" })

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), "XXYYY", "Something new")
    const loggedArgs = consoleError.mock.calls.flat()
    expect(loggedArgs.some((arg) => String(arg).includes("secret@example.com"))).toBe(false)
    consoleError.mockRestore()
  })

  it("returns backend and logs without email/token when the RPC returns no row", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: [], error: null })

    await expect(createInvitation("secret@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "backend" })

    expect(consoleError).toHaveBeenCalledWith("createInvitation: create_invitation returned no row")
    const loggedArgs = consoleError.mock.calls.flat()
    expect(loggedArgs.some((arg) => String(arg).includes("secret@example.com"))).toBe(false)
    consoleError.mockRestore()
  })

  it("refuses a manager without calling the RPC", async () => {
    mockGetUserRole.mockResolvedValue("manager")

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "forbidden" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("refuses a volunteer without calling the RPC", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "forbidden" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns unauthenticated without calling the RPC when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(createInvitation("new@example.com", "volunteer")).resolves.toEqual({ ok: false, reason: "unauthenticated" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects an invalid email without calling the RPC or adminSession", async () => {
    const result = await createInvitation("not-an-email", "volunteer")

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: "validation" })
    expect((result as { fieldErrors: Record<string, string[]> }).fieldErrors.email).toBeDefined()
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects an invalid role without calling the RPC or adminSession", async () => {
    const result = await createInvitation("new@example.com", "owner" as never)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: "validation" })
    expect((result as { fieldErrors: Record<string, string[]> }).fieldErrors.role).toBeDefined()
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
