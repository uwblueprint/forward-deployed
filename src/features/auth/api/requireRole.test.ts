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

import { redirect, notFound } from "next/navigation";
import {
  requireRole,
  requireRoleForRoute,
  type RoleResolver,
} from "./requireRole";

const user = { id: "user-1", email: "person@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireRole", () => {
  it("redirects to /login when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireRole("admin")).rejects.toThrow(RedirectError);
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("hits notFound for a signed-in user using the default placeholder stub", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });

    await expect(requireRole("admin")).rejects.toThrow(NotFoundError);
    expect(notFound).toHaveBeenCalled();
  });

  it("passes and returns the user when a resolver returns the matching role", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "admin";

    const result = await requireRole("admin", resolveRole);

    expect(result).toBe(user);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("hits notFound when a resolver returns a non-matching role", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "volunteer";

    await expect(requireRole("admin", resolveRole)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("passes for either role when allowed is a list", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const volunteerResolver: RoleResolver = async () => "volunteer";
    const adminResolver: RoleResolver = async () => "admin";

    await expect(
      requireRole(["volunteer", "admin"], volunteerResolver),
    ).resolves.toBe(user);
    await expect(
      requireRole(["volunteer", "admin"], adminResolver),
    ).resolves.toBe(user);
  });

  it("hits notFound when the resolver returns null", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => null;

    await expect(requireRole("admin", resolveRole)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("requireRoleForRoute", () => {
  it("returns 401 when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await requireRoleForRoute("admin");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns 403 when a volunteer requests admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "volunteer";

    const result = await requireRoleForRoute("admin", resolveRole);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok with the user when an admin requests admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "admin";

    const result = await requireRoleForRoute("admin", resolveRole);

    expect(result).toEqual({ ok: true, user });
  });

  it("returns 403 for the default placeholder", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });

    const result = await requireRoleForRoute("admin");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});
