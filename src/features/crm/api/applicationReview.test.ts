import { beforeEach, describe, expect, it, vi } from "vitest"

type Result = { data: unknown; error: { message: string } | null }

const { mockGetUser, mockGetUserRole, queued, calls } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserRole: vi.fn(),
  queued: {} as Record<string, Result[]>,
  calls: [] as [string, string, unknown[]][],
}))

// A query on `table` that records its chain and resolves to the next queued result.
function query(table: string) {
  const result = () => {
    const next = queued[table]?.shift()
    if (!next) throw new Error(`no result queued for ${table}`)
    return Promise.resolve(next)
  }
  const chain: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
    maybeSingle: () => result(),
  }
  for (const method of ["select", "eq", "order", "range"]) {
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

import { getApplicationReview, listApplications } from "./applicationReview"

const APP_ID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const OLD_APP_ID = "1f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const Q1 = "aaaaaaaa-0000-4000-8000-000000000001"
const Q2 = "aaaaaaaa-0000-4000-8000-000000000002"

const person = (first: string) => ({ first_name: first, last_name: "Doe", email: `${first.toLowerCase()}@example.com` })

function summaryRow(id: string, volunteer: string, status: string, submitted: string) {
  return {
    id,
    status,
    submitted_at: submitted,
    reviewed_at: status === "pending" ? null : submitted,
    volunteer_id: volunteer,
    volunteer: { user: person(volunteer) },
  }
}

const volunteer = {
  id: "v1",
  user_id: "u-ana",
  organization_id: "org1",
  phone: "555-0100",
  availability_days: ["monday"],
  skills: ["Cooking"],
  user: person("Ana"),
}

function applicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APP_ID,
    status: "pending",
    submitted_at: "2026-11-10T00:00:00Z",
    reviewed_at: null,
    applicant_message: null,
    questions: [
      { id: Q1, field_name: "Why us?", field_type: "textarea", options: [], required: true },
      { id: Q2, field_name: "Licence?", field_type: "checkbox", options: [], required: false },
    ],
    responses: { [Q1]: "To help", stray: "dropped" },
    volunteer_id: "v1",
    reviewer: null,
    volunteer,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const key of Object.keys(queued)) delete queued[key]
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  mockGetUserRole.mockResolvedValue("manager")
})

describe("listApplications", () => {
  it("keeps each volunteer's latest application, pending first and oldest first", async () => {
    queued.applications = [
      {
        data: [
          summaryRow("a-new-approved", "Bo", "approved", "2026-11-12T00:00:00Z"),
          summaryRow("a-pending-late", "Cy", "pending", "2026-11-11T00:00:00Z"),
          summaryRow("a-old-approved", "Di", "approved", "2026-11-02T00:00:00Z"),
          summaryRow("a-pending-early", "Ed", "pending", "2026-11-03T00:00:00Z"),
          // Cy's earlier, rejected application is superseded by the pending one.
          summaryRow("a-cy-rejected", "Cy", "rejected", "2026-11-01T00:00:00Z"),
        ],
        error: null,
      },
    ]

    const result = await listApplications()

    expect(result.ok && result.data.map((a) => a.id)).toEqual([
      "a-pending-early",
      "a-pending-late",
      "a-new-approved",
      "a-old-approved",
    ])
    expect(result.ok && result.data[0]).toEqual({
      id: "a-pending-early",
      status: "pending",
      submittedAt: "2026-11-03T00:00:00Z",
      reviewedAt: null,
      volunteerId: "Ed",
      applicant: person("Ed"),
    })
  })

  it("breaks a submitted_at tie by id, like the database", async () => {
    queued.applications = [
      {
        data: [
          summaryRow("a1", "Bo", "rejected", "2026-11-01T00:00:00Z"),
          summaryRow("a2", "Bo", "pending", "2026-11-01T00:00:00Z"),
        ],
        error: null,
      },
    ]

    const result = await listApplications()

    expect(result.ok && result.data.map((a) => a.id)).toEqual(["a2"])
  })

  it("reads every page, so the oldest applications aren't cut off", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => summaryRow(`a${i}`, `v${i}`, "approved", "2026-11-12T00:00:00Z"))
    queued.applications = [
      { data: full, error: null },
      { data: [summaryRow("oldest-pending", "Zed", "pending", "2026-01-01T00:00:00Z")], error: null },
    ]

    const result = await listApplications()

    expect(result.ok && result.data).toHaveLength(1001)
    expect(result.ok && result.data[0].id).toBe("oldest-pending")
    expect(calls.filter(([, method]) => method === "range").map(([, , args]) => args)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it("returns an empty queue", async () => {
    queued.applications = [{ data: [], error: null }]
    await expect(listApplications()).resolves.toEqual({ ok: true, data: [] })
  })

  it("refuses volunteers before querying", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")
    await expect(listApplications()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
    expect(calls).toEqual([])
  })

  it("refuses an unknown role", async () => {
    mockGetUserRole.mockResolvedValue(null)
    await expect(listApplications()).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })

  it("returns unauthenticated without a session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(listApplications()).resolves.toEqual({ ok: false, error: { type: "unauthenticated" } })
  })

  it("returns database errors as backend errors", async () => {
    queued.applications = [{ data: null, error: { message: "boom" } }]
    await expect(listApplications()).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})

describe("getApplicationReview", () => {
  type Sibling = { id: string; status: string; submitted_at: string; applicant_message: string | null }

  function queueSiblings(rows: Sibling[] = [{ id: APP_ID, status: "pending", submitted_at: "2026-11-10T00:00:00Z", applicant_message: null }]) {
    queued.applications.push({ data: rows, error: null })
  }

  it("labels answers with the questions as asked and drops stray answers", async () => {
    queued.applications = [{ data: applicationRow(), error: null }]
    queueSiblings()

    const result = await getApplicationReview(APP_ID)

    expect(result).toMatchObject({
      ok: true,
      data: {
        id: APP_ID,
        status: "pending",
        isOwn: false,
        isLatest: true,
        latestApplicationId: null,
        canManageNote: false,
        note: null,
        volunteer,
        otherApplications: [],
        answers: [
          { questionId: Q1, question: "Why us?", fieldType: "textarea", answer: "To help" },
          { questionId: Q2, question: "Licence?", fieldType: "checkbox", answer: null },
        ],
      },
    })
  })

  it("never reads notes for a manager", async () => {
    queued.applications = [{ data: applicationRow(), error: null }]
    queueSiblings()

    await getApplicationReview(APP_ID)

    expect(calls.some(([table]) => table === "application_notes")).toBe(false)
  })

  it("reads the note for an admin", async () => {
    mockGetUserRole.mockResolvedValue("admin")
    queued.applications = [{ data: applicationRow(), error: null }]
    queueSiblings()
    queued.application_notes = [{ data: { internal_note: "Great interview" }, error: null }]

    const result = await getApplicationReview(APP_ID)

    expect(result).toMatchObject({ ok: true, data: { canManageNote: true, note: "Great interview" } })
    expect(calls).toContainEqual(["application_notes", "eq", ["application_id", APP_ID]])
  })

  it("flags the caller's own application and never loads its note", async () => {
    mockGetUserRole.mockResolvedValue("admin")
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-ana" } } })
    queued.applications = [{ data: applicationRow(), error: null }]
    queueSiblings()

    const result = await getApplicationReview(APP_ID)

    expect(result).toMatchObject({ ok: true, data: { isOwn: true, canManageNote: false, note: null } })
    expect(calls.some(([table]) => table === "application_notes")).toBe(false)
  })

  it("falls back to the current questions for an application saved before snapshots", async () => {
    queued.applications = [{ data: applicationRow({ questions: [] }), error: null }]
    queueSiblings()
    queued.custom_fields = [{ data: [{ id: Q1, field_name: "Why us (today)?", field_type: "textarea" }], error: null }]

    const result = await getApplicationReview(APP_ID)

    expect(result.ok && result.data.answers).toEqual([
      { questionId: Q1, question: "Why us (today)?", fieldType: "textarea", answer: "To help" },
    ])
    expect(calls).toContainEqual(["custom_fields", "eq", ["organization_id", "org1"]])
    expect(calls).toContainEqual(["custom_fields", "eq", ["entity_type", "application"]])
  })

  it("flags an application that has been superseded and lists the others newest first", async () => {
    queued.applications = [{ data: applicationRow({ id: OLD_APP_ID, status: "rejected" }), error: null }]
    queueSiblings([
      { id: OLD_APP_ID, status: "rejected", submitted_at: "2026-11-01T00:00:00Z", applicant_message: "Not yet" },
      { id: APP_ID, status: "pending", submitted_at: "2026-11-10T00:00:00Z", applicant_message: null },
    ])

    const result = await getApplicationReview(OLD_APP_ID)

    expect(result).toMatchObject({
      ok: true,
      data: {
        isLatest: false,
        latestApplicationId: APP_ID,
        otherApplications: [{ id: APP_ID, status: "pending", submittedAt: "2026-11-10T00:00:00Z", applicantMessage: null }],
      },
    })
  })

  it("reads a malformed id as not found without querying", async () => {
    await expect(getApplicationReview("nope")).resolves.toEqual({ ok: false, error: { type: "not-found" } })
    expect(calls).toEqual([])
  })

  it("reads another organization's application as not found", async () => {
    queued.applications = [{ data: null, error: null }]
    await expect(getApplicationReview(APP_ID)).resolves.toEqual({ ok: false, error: { type: "not-found" } })
  })

  it("refuses volunteers", async () => {
    mockGetUserRole.mockResolvedValue("volunteer")
    await expect(getApplicationReview(APP_ID)).resolves.toEqual({ ok: false, error: { type: "forbidden" } })
  })

  it("returns a failed follow-up query as a backend error", async () => {
    queued.applications = [{ data: applicationRow(), error: null }, { data: null, error: { message: "boom" } }]

    await expect(getApplicationReview(APP_ID)).resolves.toEqual({ ok: false, error: { type: "backend", message: "boom" } })
  })
})
