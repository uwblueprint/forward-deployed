import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockGetUserRole, mockApplicationMaybeSingle, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockApplicationMaybeSingle: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== "applications") throw new Error(`unexpected table: ${table}`)
      return { select: () => ({ eq: () => ({ maybeSingle: mockApplicationMaybeSingle }) }) }
    },
    rpc: mockRpc,
  })),
}))

import { approveOrRejectApplication } from "./applicationDecisions"

const APPLICATION_ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const user = { id: "user-1" }

function staff(role: "admin" | "manager", status: "pending" | "approved" | "rejected" = "pending") {
  mockGetUser.mockResolvedValue({ data: { user } })
  mockGetUserRole.mockResolvedValue(role)
  mockApplicationMaybeSingle.mockResolvedValue({ data: { status }, error: null })
}

function decided(status: "approved" | "rejected", applicant_message: string | null = null) {
  mockRpc.mockResolvedValue({ data: { id: APPLICATION_ID, status, applicant_message }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("approveOrRejectApplication", () => {
  it("approves a pending application", async () => {
    staff("admin")
    decided("approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: true,
      data: { status: "approved" },
    })
    expect(mockRpc).toHaveBeenCalledWith("decide_application", {
      target_application_id: APPLICATION_ID,
      decision: "approved",
      message: undefined,
    })
  })

  it("rejects a pending application with the applicant's message", async () => {
    staff("admin")
    decided("rejected", "No availability")

    await expect(approveOrRejectApplication(APPLICATION_ID, "rejected", "No availability")).resolves.toEqual({
      ok: true,
      data: { status: "rejected" },
    })
    expect(mockRpc).toHaveBeenCalledWith("decide_application", {
      target_application_id: APPLICATION_ID,
      decision: "rejected",
      message: "No availability",
    })
  })

  it("doesn't send a message when approving", async () => {
    staff("admin")
    decided("approved")

    await approveOrRejectApplication(APPLICATION_ID, "approved", "Leftover text")

    expect(mockRpc).toHaveBeenCalledWith("decide_application", expect.objectContaining({ message: undefined }))
  })

  it("lets a manager decide", async () => {
    staff("manager")
    decided("approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: true,
      data: { status: "approved" },
    })
  })

  it("lets staff undo a rejection", async () => {
    staff("admin", "rejected")
    decided("approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: true,
      data: { status: "approved" },
    })
  })

  it("refuses the same decision twice", async () => {
    staff("admin", "approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "already-decided" },
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("refuses the same decision when someone else made it a moment earlier", async () => {
    staff("admin")
    mockRpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Application is already approved" } })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "already-decided" },
    })
  })

  it("refuses a volunteer", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "not-allowed" },
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("refuses when the role can't be read", async () => {
    mockGetUser.mockResolvedValue({ data: { user } })
    mockGetUserRole.mockResolvedValue(null)

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "not-allowed" },
    })
  })

  it("refuses staff deciding their own application", async () => {
    staff("manager")
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "You cannot review your own application" } })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "not-allowed" },
    })
  })

  it("returns not-found for an application outside the caller's organization", async () => {
    staff("admin")
    mockApplicationMaybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "not-found" },
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns not-latest when the volunteer has applied again since", async () => {
    staff("admin", "rejected")
    mockRpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Only the latest application can be decided" } })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "not-latest" },
    })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
  })

  it("rejects bad input before touching the database", async () => {
    const result = await approveOrRejectApplication("not-an-id", "pending" as "approved", "x".repeat(2001))

    expect(result).toEqual({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: {
          applicationId: expect.any(Array),
          decision: expect.any(Array),
          applicantMessage: expect.any(Array),
        },
      },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("passes through unexpected database errors", async () => {
    staff("admin")
    mockRpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })
})
