import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExchangeCodeForSession, mockGetUserRole, RedirectError } =
  vi.hoisted(() => {
    class RedirectError extends Error {
      constructor(public readonly url: string) {
        super(`redirect:${url}`);
      }
    }

    return {
      mockExchangeCodeForSession: vi.fn(),
      mockGetUserRole: vi.fn(),
      RedirectError,
    };
  });

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}));

vi.mock("@/features/auth", () => ({
  getUserRole: mockGetUserRole,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

import { AuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { GET } from "./route";

function makeRequest(query: string) {
  return new NextRequest(`https://example.com/auth/callback${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("redirects to the safe next path on success", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(
      GET(makeRequest("?code=abc&next=/settings")),
    ).rejects.toThrow(RedirectError);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(redirect).toHaveBeenCalledWith("/settings");
    expect(mockGetUserRole).not.toHaveBeenCalled();
  });

  it("redirects to a next path that itself contains a query string, once decoded", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const invitePath = "/auth/invite?token=abc123";

    await expect(
      GET(makeRequest(`?code=abc&next=${encodeURIComponent(invitePath)}`)),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith(invitePath);
    expect(mockGetUserRole).not.toHaveBeenCalled();
  });

  it("redirects with reason=expired when Supabase redirects with an otp_expired error", async () => {
    await expect(
      GET(
        makeRequest(
          "?error=access_denied&error_code=otp_expired&error_description=Link+expired",
        ),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=expired");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects with reason=invalid for other Supabase error redirects", async () => {
    await expect(
      GET(makeRequest("?error=access_denied&error_code=bad_request")),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects with reason=invalid when code is missing", async () => {
    await expect(GET(makeRequest(""))).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects with reason=different-browser when the code verifier is missing", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: new AuthPKCECodeVerifierMissingError(),
    });

    await expect(GET(makeRequest("?code=abc"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith(
      "/auth/error?reason=different-browser",
    );
  });

  it("redirects with reason=invalid for other exchange failures", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { name: "AuthApiError", message: "Invalid code" },
    });

    await expect(GET(makeRequest("?code=abc"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
  });

  it("redirects admins to /admin/dashboard when next is absent", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockGetUserRole.mockResolvedValue("admin");

    await expect(GET(makeRequest("?code=abc"))).rejects.toThrow(
      RedirectError,
    );

    expect(mockGetUserRole).toHaveBeenCalledWith({ id: "user-1" });
    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("redirects managers to /admin/dashboard when next is absent", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockGetUserRole.mockResolvedValue("manager");

    await expect(GET(makeRequest("?code=abc"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("redirects volunteers to /dashboard when next is absent", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockGetUserRole.mockResolvedValue("volunteer");

    await expect(GET(makeRequest("?code=abc"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("fails closed to /dashboard when getUserRole returns null", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockGetUserRole.mockResolvedValue(null);

    await expect(GET(makeRequest("?code=abc"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
