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
  for (const method of ["select"]) {
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

import { listMembers } from "./members"

function membershipRow(role: string, user: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null) {
  return { role, user }
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const key of Object.keys(queued)) delete queued[key]
  mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
  mockGetUserRole.mockResolvedValue("admin")
})

describe("listMembers", () => {
  it("maps each membership to a team member, flagging the caller's own row", async () => {
    queued.memberships = [
      {
        data: [
          membershipRow("admin", { id: "admin-1", first_name: "Ana", last_name: "Lee", email: "ana@example.com" }),
          membershipRow("volunteer", { id: "u2", first_name: "Bo", last_name: "Diaz", email: "bo@example.com" }),
        ],
        error: null,
      },
    ]

    const result = await listMembers()

    expect(result).toEqual({
      ok: true,
      data: [
        { id: "u2", firstName: "Bo", lastName: "Diaz", email: "bo@example.com", role: "volunteer", isCurrentUser: false },
        { id: "admin-1", firstName: "Ana", lastName: "Lee", email: "ana@example.com", role: "admin", isCurrentUser: true },
      ],
    })
  })

  it("sorts by last name then first name, case-insensitively, with no name last", async () => {
    queued.memberships = [
      {
        data: [
          membershipRow("volunteer", { id: "u-bob", first_name: "bob", last_name: "zed", email: "bob@example.com" }),
          membershipRow("volunteer", { id: "u-noname", first_name: null, last_name: null, email: "noname@example.com" }),
          membershipRow("volunteer", { id: "u-amy", first_name: "Amy", last_name: "Adams", email: "amy@example.com" }),
          membershipRow("volunteer", { id: "u-ann", first_name: "ann", last_name: "Adams", email: "ann@example.com" }),
        ],
        error: null,
      },
    ]

    const result = await listMembers()

    expect(result.ok && result.data.map((m) => m.id)).toEqual(["u-amy", "u-ann", "u-bob", "u-noname"])
  })

  it("drops a membership whose user row is hidden by RLS", async () => {
    queued.memberships = [{ data: [membershipRow("volunteer", null)], error: null }]

    await expect(listMembers()).resolves.toEqual({ ok: true, data: [] })
  })

  it("refuses a manager", async () => {
    mockGetUserRole.mockResolvedValue("manager")

    await expect(listMembers()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(calls).toEqual([])
  })

  it("refuses a volunteer", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")

    await expect(listMembers()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(listMembers()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns database errors as backend errors", async () => {
    queued.memberships = [{ data: null, error: { message: "boom" } }]

    await expect(listMembers()).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})
