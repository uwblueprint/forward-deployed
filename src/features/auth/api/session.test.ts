import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { GET } from "@/app/api/auth/me/route";
import { isProtectedPath } from "./session";

const user = { id: "user-1", email: "person@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isProtectedPath", () => {
  it.each([
    ["/dashboard", true],
    ["/dashboard/x", true],
    ["/admin", true],
    ["/admin/dashboard", true],
  ])("treats %s as protected", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });

  it.each([
    ["/login", false],
    ["/register", false],
    ["/", false],
    ["/administrator", false],
  ])("does not treat %s as protected", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 200 with only id and email when there is a session", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          ...user,
          app_metadata: { provider: "email" },
          user_metadata: { role: "admin" },
        },
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(user);
  });
});
