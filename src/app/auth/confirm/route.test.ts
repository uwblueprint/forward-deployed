import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyOtp, RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public readonly url: string) {
      super(`redirect:${url}`);
    }
  }

  return { mockVerifyOtp: vi.fn(), RedirectError };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { verifyOtp: mockVerifyOtp },
  })),
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
  return new NextRequest(`https://example.com/auth/confirm${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/confirm", () => {
  it("redirects to the safe next path on success", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    await expect(
      GET(makeRequest("?token_hash=abc&type=email&next=/settings")),
    ).rejects.toThrow(RedirectError);

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "abc",
    });
    expect(redirect).toHaveBeenCalledWith("/settings");
  });

  it("defaults to /dashboard when next is missing", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    await expect(
      GET(makeRequest("?token_hash=abc&type=email")),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects with reason=expired for an expired or already-used link", async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid", code: "otp_expired" },
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=email")),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=expired");
  });

  it("redirects with reason=invalid for other verification failures", async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: "Invalid token", code: "validation_failed" },
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=email")),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
  });

  it("redirects with reason=invalid when token_hash is missing", async () => {
    await expect(GET(makeRequest("?type=email"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it("redirects with reason=invalid when type is missing or not a signup type", async () => {
    await expect(GET(makeRequest("?token_hash=abc"))).rejects.toThrow(
      RedirectError,
    );
    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");

    vi.clearAllMocks();

    await expect(
      GET(makeRequest("?token_hash=abc&type=recovery")),
    ).rejects.toThrow(RedirectError);
    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});
