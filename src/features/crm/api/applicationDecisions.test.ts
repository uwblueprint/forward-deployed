import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}))

import { approveOrRejectApplication, editApplicantMessage } from "./applicationDecisions"

const APPLICATION_ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"

function signedIn() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
}

function decides(status: "approved" | "rejected") {
  mockRpc.mockResolvedValue({ data: { id: APPLICATION_ID, status }, error: null })
}

function fails(code: string, message: string) {
  mockRpc.mockResolvedValue({ data: null, error: { code, message, details: null, hint: null } })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("approveOrRejectApplication", () => {
  it("approves a pending application", async () => {
    signedIn()
    decides("approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: true,
      data: { status: "approved" },
    })
    expect(mockRpc).toHaveBeenCalledWith("decide_application", {
      target_application_id: APPLICATION_ID,
      decision: "approved",
      message: undefined,
      expected_status: "pending",
    })
  })

  it("rejects a pending application with the applicant's message", async () => {
    signedIn()
    decides("rejected")

    await expect(approveOrRejectApplication(APPLICATION_ID, "rejected", "No availability")).resolves.toEqual({
      ok: true,
      data: { status: "rejected" },
    })
    expect(mockRpc).toHaveBeenCalledWith("decide_application", {
      target_application_id: APPLICATION_ID,
      decision: "rejected",
      message: "No availability",
      expected_status: "pending",
    })
  })

  it("ignores a leftover message when approving, however long", async () => {
    signedIn()
    decides("approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved", "x".repeat(5000))).resolves.toMatchObject({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("decide_application", expect.objectContaining({ message: undefined }))
  })

  it("changes a decision when told what it was", async () => {
    signedIn()
    decides("approved")

    await expect(
      approveOrRejectApplication(APPLICATION_ID, "approved", undefined, { expectedStatus: "rejected" })
    ).resolves.toEqual({ ok: true, data: { status: "approved" } })
    expect(mockRpc).toHaveBeenCalledWith("decide_application", expect.objectContaining({ expected_status: "rejected" }))
  })

  it("passes an admin's internal note through with the decision", async () => {
    signedIn()
    decides("rejected")

    await approveOrRejectApplication(APPLICATION_ID, "rejected", "Not this season", { note: "Prefers weekends" })

    expect(mockRpc).toHaveBeenCalledWith("decide_application", {
      target_application_id: APPLICATION_ID,
      decision: "rejected",
      message: "Not this season",
      note: "Prefers weekends",
      expected_status: "pending",
    })
  })

  it("maps a manager's note to not-allowed (only admins write notes)", async () => {
    signedIn()
    fails("42501", "Only admins can write internal notes")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved", undefined, { note: "x" })).resolves.toEqual({
      ok: false,
      error: { type: "not-allowed" },
    })
  })

  it("rejects a note over 5000 characters", async () => {
    const result = await approveOrRejectApplication(APPLICATION_ID, "approved", undefined, { note: "x".repeat(5001) })

    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { note: expect.any(Array) } } })
  })

  it("lets a manager decide (the database decides who is staff)", async () => {
    signedIn()
    decides("approved")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toMatchObject({ ok: true })
  })

  it.each([
    ["42501", "Only staff can decide applications", "not-allowed", "a volunteer calls it"],
    ["42501", "You cannot review your own application", "not-allowed", "staff decide their own application"],
    ["P0002", "Application not found in your organization", "not-found", "the application is in another organization"],
    ["22023", "Application is already approved", "already-decided", "the same decision is made twice"],
    ["22023", "Application is rejected, not pending", "already-decided", "someone else decided it first"],
    ["55000", "Only the latest application can be decided", "not-latest", "the volunteer has applied again"],
  ])("maps %s (%s) to %s when %s", async (code, message, type) => {
    signedIn()
    fails(code, message)

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type },
    })
  })

  it("returns unexpected database errors as backend errors", async () => {
    signedIn()
    fails("XX000", "boom")

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "backend", message: "boom" },
    })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(approveOrRejectApplication(APPLICATION_ID, "approved")).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects bad input before touching the database", async () => {
    const result = await approveOrRejectApplication("not-an-id", "pending" as "approved", undefined, {
      expectedStatus: "maybe" as "pending",
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: {
          applicationId: expect.any(Array),
          decision: expect.any(Array),
          expectedStatus: expect.any(Array),
        },
      },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("rejects a rejection message over 2000 characters", async () => {
    const result = await approveOrRejectApplication(APPLICATION_ID, "rejected", "x".repeat(2001))

    expect(result).toMatchObject({ ok: false, error: { type: "validation", fieldErrors: { applicantMessage: expect.any(Array) } } })
  })
})

describe("editApplicantMessage", () => {
  it("saves the new message and returns what was stored", async () => {
    signedIn()
    mockRpc.mockResolvedValue({ data: { id: APPLICATION_ID, applicant_message: "Try again in spring" }, error: null })

    await expect(editApplicantMessage(APPLICATION_ID, "Try again in spring")).resolves.toEqual({
      ok: true,
      data: { applicantMessage: "Try again in spring" },
    })
    expect(mockRpc).toHaveBeenCalledWith("edit_applicant_message", {
      target_application_id: APPLICATION_ID,
      message: "Try again in spring",
    })
  })

  it("returns the organization's default when the message is left blank", async () => {
    signedIn()
    mockRpc.mockResolvedValue({ data: { id: APPLICATION_ID, applicant_message: "Org default" }, error: null })

    await expect(editApplicantMessage(APPLICATION_ID, "")).resolves.toEqual({
      ok: true,
      data: { applicantMessage: "Org default" },
    })
  })

  it.each([
    ["42501", "not-allowed"],
    ["P0002", "not-found"],
    ["22023", "not-rejected"],
  ])("maps %s to %s", async (code, type) => {
    signedIn()
    fails(code, "x")

    await expect(editApplicantMessage(APPLICATION_ID, "x")).resolves.toEqual({ ok: false, error: { type } })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(editApplicantMessage(APPLICATION_ID, "x")).resolves.toEqual({
      ok: false,
      error: { type: "unauthenticated" },
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects bad input before touching the database", async () => {
    const result = await editApplicantMessage("not-an-id", "x".repeat(2001))

    expect(result).toMatchObject({
      ok: false,
      error: { type: "validation", fieldErrors: { applicationId: expect.any(Array), applicantMessage: expect.any(Array) } },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
  })
})
