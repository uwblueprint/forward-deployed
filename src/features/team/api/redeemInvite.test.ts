import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, rpc: mockRpc })),
}))

import { redeemInvite } from "./redeemInvite"

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
})

describe("redeemInvite", () => {
  it("returns the organization id on success", async () => {
    mockRpc.mockResolvedValue({ data: "org-1", error: null })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: true, organizationId: "org-1" })
    expect(mockRpc).toHaveBeenCalledWith("redeem_invitation", { invitation_token: "tok" })
  })

  it("returns unauthenticated without calling the RPC when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "unauthenticated" })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("maps P0002 to not-found", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "Invitation not found" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "not-found" })
  })

  it("maps 'Invitation already used' to used", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Invitation already used" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "used" })
  })

  it("maps 'Invitation revoked' to revoked", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Invitation revoked" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "revoked" })
  })

  it("maps 'Invitation expired' to expired", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Invitation expired" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "expired" })
  })

  it("maps the different-email message to wrong-email", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "This invitation is for a different email address" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "wrong-email" })
  })

  it("maps the unconfirmed-email message to unconfirmed-email", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Confirm your email address first" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "unconfirmed-email" })
  })

  it("maps 'You already belong to an organization' to already-member", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "23505", message: "You already belong to an organization" } })

    await expect(redeemInvite("tok")).resolves.toEqual({ ok: false, reason: "already-member" })
  })

  it("falls back to not-found and logs the error without the token for an unrecognized message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { code: "XXYYY", message: "Something new" } })

    await expect(redeemInvite("super-secret-token")).resolves.toEqual({ ok: false, reason: "not-found" })

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), "XXYYY", "Something new")
    const loggedArgs = consoleError.mock.calls.flat()
    expect(loggedArgs.some((arg) => String(arg).includes("super-secret-token"))).toBe(false)
    consoleError.mockRestore()
  })
})
