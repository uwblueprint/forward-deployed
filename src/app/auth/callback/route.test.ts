import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExchangeCodeForSession, RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public readonly url: string) {
      super(`redirect:${url}`);
    }
  }

  return { mockExchangeCodeForSession: vi.fn(), RedirectError };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
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
});
