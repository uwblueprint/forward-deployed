import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, RedirectError, NotFoundError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public readonly url: string) {
      super(`redirect:${url}`);
    }
  }

  class NotFoundError extends Error {
    constructor() {
      super("not-found");
    }
  }

  return {
    mockGetUser: vi.fn(),
    RedirectError,
    NotFoundError,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
  notFound: vi.fn(() => {
    throw new NotFoundError();
  }),
}));

import { GET } from "@/app/api/auth/me/route";
import { redirect, notFound } from "next/navigation";
import { isProtectedPath, requireRole, type RoleResolver } from "./session";

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

describe("requireRole", () => {
  it("redirects to /login when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireRole("admin")).rejects.toThrow(RedirectError);
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("hits notFound for a signed-in user using the default getUserRole stub", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });

    await expect(requireRole("admin")).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
  });

  it("passes and returns the user when an injected resolver returns the matching role", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "admin";

    const result = await requireRole("admin", resolveRole);

    expect(result).toBe(user);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("hits notFound when an injected resolver returns a non-matching role", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "volunteer";

    await expect(requireRole("admin", resolveRole)).rejects.toThrow(
      NotFoundError,
    );
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
