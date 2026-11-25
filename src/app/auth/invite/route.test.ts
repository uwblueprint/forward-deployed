import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockGetUserRole, mockRedeemInvite, RedirectError } =
  vi.hoisted(() => {
    class RedirectError extends Error {
      constructor(public readonly url: string) {
        super(`redirect:${url}`);
      }
    }

    return {
      mockGetUser: vi.fn(),
      mockGetUserRole: vi.fn(),
      mockRedeemInvite: vi.fn(),
      RedirectError,
    };
  });

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/features/auth", () => ({
  getUserRole: mockGetUserRole,
}));

vi.mock("@/features/team", () => ({
  redeemInvite: mockRedeemInvite,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { GET } from "./route";

function makeRequest(query: string) {
  return new NextRequest(`https://example.com/auth/invite${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/invite", () => {
  it("redirects with reason=invalid when token is missing", async () => {
    await expect(GET(makeRequest(""))).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to /login with next pointing back at this route", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(GET(makeRequest("?token=abc123"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/auth/invite?token=abc123")}`,
    );
    expect(mockRedeemInvite).not.toHaveBeenCalled();
  });

  it("double-encodes a token containing & and + so the return path survives intact", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const token = "a&b+c";

    await expect(
      GET(makeRequest(`?token=${encodeURIComponent(token)}`)),
    ).rejects.toThrow(RedirectError);

    const expectedInvitePath = `/auth/invite?token=${encodeURIComponent(token)}`;
    expect(redirect).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent(expectedInvitePath)}`,
    );

    const loginUrl = new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.com");
    const backTo = new URL(loginUrl.searchParams.get("next")!, "https://example.com");
    expect(backTo.searchParams.get("token")).toBe("a&b+c");
  });

  it("redeems and redirects an admin to /admin/dashboard on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRedeemInvite.mockResolvedValue({ ok: true, organizationId: "org-1" });
    mockGetUserRole.mockResolvedValue("admin");

    await expect(GET(makeRequest("?token=abc123"))).rejects.toThrow(
      RedirectError,
    );

    expect(mockRedeemInvite).toHaveBeenCalledWith("abc123");
    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("redeems and redirects a manager to /admin/dashboard on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRedeemInvite.mockResolvedValue({ ok: true, organizationId: "org-1" });
    mockGetUserRole.mockResolvedValue("manager");

    await expect(GET(makeRequest("?token=abc123"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("redeems and redirects a volunteer to /dashboard on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRedeemInvite.mockResolvedValue({ ok: true, organizationId: "org-1" });
    mockGetUserRole.mockResolvedValue("volunteer");

    await expect(GET(makeRequest("?token=abc123"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it.each([
    ["not-found", "invalid"],
    ["expired", "invite-expired"],
    ["revoked", "invite-revoked"],
    ["used", "invite-used"],
    ["wrong-email", "invite-wrong-email"],
    ["unconfirmed-email", "invite-unconfirmed-email"],
    ["already-member", "invite-already-member"],
  ])("redirects reason=%s to /auth/error?reason=%s", async (reason, expectedReason) => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRedeemInvite.mockResolvedValue({ ok: false, reason });

    await expect(GET(makeRequest("?token=abc123"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith(`/auth/error?reason=${expectedReason}`);
  });
});
