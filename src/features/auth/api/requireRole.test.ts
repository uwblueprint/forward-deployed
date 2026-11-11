import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockFrom, mockEq, mockMaybeSingle, RedirectError, NotFoundError } = vi.hoisted(
  () => {
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
      mockFrom: vi.fn(),
      mockEq: vi.fn(),
      mockMaybeSingle: vi.fn(),
      RedirectError,
      NotFoundError,
    };
  },
);

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: mockEq.mockImplementation(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
    })),
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

import type { User } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";
import {
  getUserRole,
  requireRole,
  requireRoleForRoute,
  type RoleResolver,
} from "./requireRole";

const user = { id: "user-1", email: "person@example.com" } as User;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserRole", () => {
  it("returns the role from the user's membership", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: "manager" }, error: null });

    await expect(getUserRole(user)).resolves.toBe("manager");
    expect(mockFrom).toHaveBeenCalledWith("memberships");
    expect(mockEq).toHaveBeenCalledWith("user_id", user.id);
  });

  it("returns null on a query error", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    await expect(getUserRole(user)).resolves.toBeNull();
  });

  it("returns volunteer when the user hasn't joined an organization", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getUserRole(user)).resolves.toBe("volunteer");
  });

  it("returns null for an unknown role value", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { role: "superadmin" },
      error: null,
    });

    await expect(getUserRole(user)).resolves.toBeNull();
  });
});

describe("requireRole", () => {
  it("redirects to /login when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireRole("admin")).rejects.toThrow(RedirectError);
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("hits notFound for a signed-in user without an admin membership", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

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
    const managerResolver: RoleResolver = async () => "manager";
    const adminResolver: RoleResolver = async () => "admin";

    await expect(
      requireRole(["admin", "manager"], managerResolver),
    ).resolves.toBe(user);
    await expect(
      requireRole(["admin", "manager"], adminResolver),
    ).resolves.toBe(user);
  });

  it("hits notFound when a volunteer requests an admin/manager area", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "volunteer";

    await expect(
      requireRole(["admin", "manager"], resolveRole),
    ).rejects.toThrow(NotFoundError);
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

  it("returns 403 for the default resolver when the role query returns no row", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await requireRoleForRoute("admin");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok when a manager requests an admin/manager route", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "manager";

    const result = await requireRoleForRoute(
      ["admin", "manager"],
      resolveRole,
    );

    expect(result).toEqual({ ok: true, user });
  });

  it("returns 403 when a volunteer requests an admin/manager route", async () => {
    mockGetUser.mockResolvedValue({ data: { user } });
    const resolveRole: RoleResolver = async () => "volunteer";

    const result = await requireRoleForRoute(
      ["admin", "manager"],
      resolveRole,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});
