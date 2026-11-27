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

import { revokeInvitation } from "./revokeInvitation"

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

const invitationId = "22222222-2222-4222-8222-222222222222"

describe("revokeInvitation", () => {
  it("revokes the invitation on success", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("revoke_invitation", { target_invitation_id: invitationId })
  })

  it("maps P0002 to not-found", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "No open invitation with that id in your organization" },
    })

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: false, reason: "not-found" })
  })

  it("maps 'Only admins can revoke invitations' to forbidden", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only admins can revoke invitations" } })

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: false, reason: "forbidden" })
  })

  it("falls back to backend and logs the error without the invitation id for an unrecognized message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { code: "XXYYY", message: "Something new" } })

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: false, reason: "backend" })

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), "XXYYY", "Something new")
    const loggedArgs = consoleError.mock.calls.flat()
    expect(loggedArgs.some((arg) => String(arg).includes(invitationId))).toBe(false)
    consoleError.mockRestore()
  })

  it("refuses a manager without calling the RPC", async () => {
    mockGetUserRole.mockResolvedValue("manager")

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: false, reason: "forbidden" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("refuses a volunteer without calling the RPC", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: false, reason: "forbidden" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns unauthenticated without calling the RPC when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(revokeInvitation(invitationId)).resolves.toEqual({ ok: false, reason: "unauthenticated" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects a malformed invitation id without calling the RPC or adminSession", async () => {
    const result = await revokeInvitation("not-a-uuid")

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: "validation" })
    expect((result as { fieldErrors: Record<string, string[]> }).fieldErrors.invitationId).toBeDefined()
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
