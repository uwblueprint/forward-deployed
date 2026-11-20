import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockMembership, mockRepo } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMembership: vi.fn(),
  mockRepo: { getById: vi.fn(), create: vi.fn(), update: vi.fn() },
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== "memberships") throw new Error(`unexpected table: ${table}`)
      return { select: () => ({ eq: () => ({ maybeSingle: mockMembership }) }) }
    },
  })),
}))

vi.mock("@/lib/adapters", () => ({ eventRepo: mockRepo }))

import { createEvent, updateEvent } from "./manageEvents"

const ORG = "org-1"
const valid = {
  title: "Saturday sorting shift",
  starts_at: "2026-12-05T14:00:00.000Z",
  ends_at: "2026-12-05T17:00:00.000Z",
  capacity: 20,
}
const stored = {
  id: "e1",
  organization_id: ORG,
  status: "draft",
  title: "Saturday sorting shift",
  description: null,
  category: null,
  location: null,
  requirements: null,
  starts_at: "2026-12-05T14:00:00+00:00",
  ends_at: "2026-12-05T17:00:00+00:00",
  capacity: 20,
  registration_deadline: "2026-12-04T14:00:00+00:00",
  registration_count: 3,
  created_at: "2026-11-01T00:00:00+00:00",
  updated_at: "2026-11-01T00:00:00+00:00",
}

function signedInAs(role: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockMembership.mockResolvedValue({ data: role ? { organization_id: ORG, role } : null, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  signedInAs("admin")
})

describe("createEvent", () => {
  it("creates a draft in the caller's organization", async () => {
    mockRepo.create.mockResolvedValue(stored)
    await expect(createEvent(valid)).resolves.toEqual({ ok: true, data: stored })
    expect(mockRepo.create).toHaveBeenCalledWith({
      ...valid,
      description: null,
      category: null,
      location: null,
      requirements: null,
      registration_deadline: null,
      organization_id: ORG,
    })
  })

  it("ignores an organization_id or status in the input", async () => {
    mockRepo.create.mockResolvedValue(stored)
    await createEvent({ ...valid, organization_id: "other-org", status: "published" })
    const written = mockRepo.create.mock.calls[0][0]
    expect(written.organization_id).toBe(ORG)
    expect(written).not.toHaveProperty("status")
  })

  it("lets managers create events", async () => {
    signedInAs("manager")
    mockRepo.create.mockResolvedValue(stored)
    expect((await createEvent(valid)).ok).toBe(true)
  })

  it("returns field errors before touching the database", async () => {
    const result = await createEvent({ ...valid, ends_at: valid.starts_at, capacity: 0 })
    expect(result).toEqual({
      ok: false,
      error: { type: "validation", fieldErrors: expect.objectContaining({ ends_at: expect.any(Array), capacity: expect.any(Array) }) },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it("rejects signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(createEvent(valid)).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it.each([["volunteer"], [null]])("forbids a %s caller", async (role) => {
    signedInAs(role)
    await expect(createEvent(valid)).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it("maps an RLS rejection to forbidden", async () => {
    mockRepo.create.mockRejectedValue({ code: "42501", message: "new row violates row-level security policy" })
    await expect(createEvent(valid)).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })

  it("passes other database errors through as backend errors", async () => {
    mockRepo.create.mockRejectedValue({ code: "XX000", message: "boom" })
    await expect(createEvent(valid)).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})

describe("updateEvent", () => {
  beforeEach(() => {
    mockRepo.getById.mockResolvedValue(stored)
  })

  it("writes only the fields given", async () => {
    mockRepo.update.mockResolvedValue({ ...stored, title: "New title" })
    const result = await updateEvent("e1", { title: "New title" })
    expect(result).toEqual({ ok: true, data: { ...stored, title: "New title" } })
    expect(mockRepo.update).toHaveBeenCalledWith("e1", { title: "New title" })
  })

  it("clears an optional field with null", async () => {
    mockRepo.update.mockResolvedValue({ ...stored, capacity: null })
    await updateEvent("e1", { capacity: null })
    expect(mockRepo.update).toHaveBeenCalledWith("e1", { capacity: null })
  })

  it("checks a moved start against the stored end", async () => {
    const result = await updateEvent("e1", { starts_at: "2026-12-05T18:00:00.000Z" })
    expect(result).toEqual({
      ok: false,
      error: { type: "validation", fieldErrors: { ends_at: ["End must be after the start"] } },
    })
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it("checks a moved start against the stored deadline", async () => {
    const result = await updateEvent("e1", {
      starts_at: "2026-12-03T14:00:00.000Z",
      ends_at: "2026-12-03T17:00:00.000Z",
    })
    expect(result).toMatchObject({ ok: false, error: { fieldErrors: { registration_deadline: expect.any(Array) } } })
  })

  it("allows moving the start once the deadline is cleared in the same edit", async () => {
    const changes = { starts_at: "2026-12-03T14:00:00.000Z", ends_at: "2026-12-03T17:00:00.000Z", registration_deadline: null }
    mockRepo.update.mockResolvedValue({ ...stored, ...changes })
    expect((await updateEvent("e1", changes)).ok).toBe(true)
    expect(mockRepo.update).toHaveBeenCalledWith("e1", changes)
  })

  it("reports an event it can't see (another organization's) as not found", async () => {
    mockRepo.getById.mockResolvedValue(null)
    await expect(updateEvent("e1", { title: "x" })).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it("does not write when nothing changed", async () => {
    await expect(updateEvent("e1", {})).resolves.toEqual({ ok: true, data: stored })
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it("ignores a status in the input", async () => {
    mockRepo.update.mockResolvedValue(stored)
    await updateEvent("e1", { title: "x", status: "published" })
    expect(mockRepo.update).toHaveBeenCalledWith("e1", { title: "x" })
  })

  it("forbids non-staff before reading the event", async () => {
    signedInAs("volunteer")
    await expect(updateEvent("e1", { title: "x" })).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(mockRepo.getById).not.toHaveBeenCalled()
  })

  it("maps an RLS rejection on write to forbidden", async () => {
    mockRepo.update.mockRejectedValue({ code: "42501", message: "denied" })
    await expect(updateEvent("e1", { title: "x" })).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })
})
