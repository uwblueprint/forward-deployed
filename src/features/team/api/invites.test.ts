import { beforeEach, describe, expect, it, vi } from "vitest"

type Result = { data: unknown; error: { message: string } | null }

const { mockGetUser, mockGetUserRole, queued, calls } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  queued: {} as Record<string, Result[]>,
  calls: [] as [string, string, unknown[]][],
}))

function query(table: string) {
  const result = () => {
    const next = queued[table]?.shift()
    if (!next) throw new Error(`no result queued for ${table}`)
    return Promise.resolve(next)
  }
  const chain: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
  }
  for (const method of ["select", "is", "gt", "order"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([table, method, args])
      return chain
    }
  }
  return chain
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, from: query })),
}))

vi.mock("@/features/auth", () => ({ getUserRole: mockGetUserRole }))

import { listUnusedInvites } from "./invites"

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const key of Object.keys(queued)) delete queued[key]
  mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

describe("listUnusedInvites", () => {
  it("maps rows and never selects the token", async () => {
    queued.invitations = [
      {
        data: [
          { id: "inv-1", email: "new@example.com", role: "manager", created_at: "2026-11-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z" },
        ],
        error: null,
      },
    ]

    const result = await listUnusedInvites()

    expect(result).toEqual({
      ok: true,
      data: [{ id: "inv-1", email: "new@example.com", role: "manager", createdAt: "2026-11-01T00:00:00Z", expiresAt: "2026-12-01T00:00:00Z" }],
    })
    const selectCall = calls.find(([, method]) => method === "select")
    expect(selectCall?.[2][0]).not.toContain("token")
  })

  it("filters out revoked, redeemed, and expired invites", async () => {
    queued.invitations = [{ data: [], error: null }]

    await listUnusedInvites()

    expect(calls).toContainEqual(["invitations", "is", ["revoked_at", null]])
    expect(calls).toContainEqual(["invitations", "is", ["redeemed_at", null]])
    expect(calls).toContainEqual(["invitations", "gt", ["expires_at", expect.any(String)]])
  })

  it("refuses a manager", async () => {
    mockGetUserRole.mockResolvedValue("manager")

    await expect(listUnusedInvites()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(calls).toEqual([])
  })

  it("refuses a volunteer", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(listUnusedInvites()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(listUnusedInvites()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns database errors as backend errors", async () => {
    queued.invitations = [{ data: null, error: { message: "boom" } }]

    await expect(listUnusedInvites()).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})
