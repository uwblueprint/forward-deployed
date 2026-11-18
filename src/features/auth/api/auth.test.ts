import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOutMock = vi.fn();
const resetPasswordForEmail = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();
const resend = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      signInWithPassword,
      signUp,
      signOut: signOutMock,
      resetPasswordForEmail,
      verifyOtp,
      updateUser,
      resend,
    },
  })),
}));

import {
  requestPasswordReset,
  resendVerificationEmail,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
  verifyResetCode,
} from "./auth";

beforeEach(() => {
  signInWithPassword.mockReset();
  signUp.mockReset();
  signOutMock.mockReset();
  resetPasswordForEmail.mockReset();
  verifyOtp.mockReset();
  updateUser.mockReset();
  resend.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signInWithEmail", () => {
  it("rejects invalid input before calling Supabase", async () => {
    const result = await signInWithEmail({ email: "not-an-email", password: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
    }
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns ok: true on successful sign-in", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "token" } },
      error: null,
    });

    const result = await signInWithEmail({
      email: "person@example.com",
      password: "password123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user).toEqual({ id: "user-1" });
    }
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "password123",
    });
  });

  it("returns ok: false with the backend error when Supabase fails", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await signInWithEmail({
      email: "person@example.com",
      password: "wrong-password",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("backend");
      if (result.error.type === "backend") {
        expect(result.error.message).toBe("Invalid login credentials");
      }
    }
  });
});

describe("signUpWithEmail", () => {
  it("rejects invalid input before calling Supabase", async () => {
    const result = await signUpWithEmail({
      firstName: "Jane",
      lastName: "Doe",
      email: "not-an-email",
      password: "short",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
    }
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects missing first and last name before calling Supabase", async () => {
    const result = await signUpWithEmail({
      firstName: "",
      lastName: "",
      email: "new@example.com",
      password: "password123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
      if (result.error.type === "validation") {
        expect(result.error.fieldErrors.firstName).toBeDefined();
        expect(result.error.fieldErrors.lastName).toBeDefined();
      }
    }
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only first and last name before calling Supabase", async () => {
    const result = await signUpWithEmail({
      firstName: "   ",
      lastName: "   ",
      email: "new@example.com",
      password: "password123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
      if (result.error.type === "validation") {
        expect(result.error.fieldErrors.firstName).toBeDefined();
        expect(result.error.fieldErrors.lastName).toBeDefined();
      }
    }
    expect(signUp).not.toHaveBeenCalled();
  });

  it("returns ok: true on successful sign-up", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-2" }, session: null },
      error: null,
    });

    const result = await signUpWithEmail({
      firstName: "Jane",
      lastName: "Doe",
      email: "new@example.com",
      password: "password123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user).toEqual({ id: "user-2" });
    }
    expect(signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        data: {
          first_name: "Jane",
          last_name: "Doe",
        },
      },
    });
  });

  it("returns ok: false with the backend error when Supabase fails", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const result = await signUpWithEmail({
      firstName: "Jane",
      lastName: "Doe",
      email: "new@example.com",
      password: "password123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("backend");
      if (result.error.type === "backend") {
        expect(result.error.message).toBe("User already registered");
      }
    }
  });

  it("passes emailRedirectTo into options when provided", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-3" }, session: null },
      error: null,
    });

    await signUpWithEmail(
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      },
      { emailRedirectTo: "https://example.com/auth/callback?next=/dashboard" },
    );

    expect(signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "https://example.com/auth/callback?next=/dashboard",
        data: {
          first_name: "Jane",
          last_name: "Doe",
        },
      },
    });
  });
});

describe("signOut", () => {
  it("calls Supabase sign-out and returns ok: true", async () => {
    signOutMock.mockResolvedValue({ error: null });

    const result = await signOut();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it("returns ok: false with the backend error when Supabase fails", async () => {
    signOutMock.mockResolvedValue({ error: { message: "Network error" } });

    const result = await signOut();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("backend");
      if (result.error.type === "backend") {
        expect(result.error.message).toBe("Network error");
      }
    }
  });
});

describe("requestPasswordReset", () => {
  it("rejects an invalid email before calling Supabase", async () => {
    const result = await requestPasswordReset({ email: "not-an-email" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
    }
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("returns ok: true on success", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await requestPasswordReset({
      email: "person@example.com",
    });

    expect(result.ok).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("person@example.com");
  });

  it("returns ok: false with a backend error when Supabase errors (e.g. rate limit)", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: "Email rate limit exceeded" },
    });

    const result = await requestPasswordReset({
      email: "person@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("backend");
      if (result.error.type === "backend") {
        expect(result.error.message).toBe("Email rate limit exceeded");
      }
    }
  });
});

describe("verifyResetCode", () => {
  it("rejects a non-digit code before calling Supabase", async () => {
    const result = await verifyResetCode({
      email: "person@example.com",
      code: "abc123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("calls verifyOtp with type recovery and returns ok on success", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: { id: "user-4" }, session: { access_token: "token" } },
      error: null,
    });

    const result = await verifyResetCode({
      email: "person@example.com",
      code: "123456",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user).toEqual({ id: "user-4" });
    }
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "123456",
      type: "recovery",
    });
  });

  it("returns ok: false with a backend error for a wrong or expired code", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Token has expired or is invalid" },
    });

    const result = await verifyResetCode({
      email: "person@example.com",
      code: "000000",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("backend");
      if (result.error.type === "backend") {
        expect(result.error.message).toBe("Token has expired or is invalid");
      }
    }
  });
});

describe("updatePassword", () => {
  it("rejects mismatched passwords before calling Supabase", async () => {
    const result = await updatePassword({
      password: "password123",
      confirmPassword: "password456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
    }
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("returns ok: true on success", async () => {
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });

    const result = await updatePassword({
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ password: "password123" });
  });

  it("returns ok: false with the backend error when Supabase fails", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { message: "Auth session missing" },
    });

    const result = await updatePassword({
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("backend");
      if (result.error.type === "backend") {
        expect(result.error.message).toBe("Auth session missing");
      }
    }
  });
});

describe("resendVerificationEmail", () => {
  it("rejects an invalid email before calling Supabase", async () => {
    const result = await resendVerificationEmail({ email: "not-an-email" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("validation");
    }
    expect(resend).not.toHaveBeenCalled();
  });

  it("calls resend with type signup and the parsed email", async () => {
    resend.mockResolvedValue({ data: {}, error: null });

    await resendVerificationEmail({ email: "person@example.com" });

    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person@example.com",
    });
  });

  it("includes emailRedirectTo in options when provided", async () => {
    resend.mockResolvedValue({ data: {}, error: null });

    await resendVerificationEmail(
      { email: "person@example.com" },
      { emailRedirectTo: "https://example.com/auth/callback?next=/dashboard" },
    );

    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person@example.com",
      options: {
        emailRedirectTo: "https://example.com/auth/callback?next=/dashboard",
      },
    });
  });

  it("omits the options key entirely when no emailRedirectTo is given", async () => {
    resend.mockResolvedValue({ data: {}, error: null });

    await resendVerificationEmail({ email: "person@example.com" });

    const call = resend.mock.calls[0][0];
    expect(call).not.toHaveProperty("options");
  });

  it("returns ok: true on success", async () => {
    resend.mockResolvedValue({ data: {}, error: null });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns ok: true and logs without the email for user_not_found", async () => {
    resend.mockResolvedValue({
      data: null,
      error: { message: "User not found", code: "user_not_found", status: 400 },
    });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ code: "user_not_found", status: 400 }),
    );
    for (const call of (console.error as ReturnType<typeof vi.fn>).mock
      .calls) {
      for (const arg of call) {
        expect(JSON.stringify(arg)).not.toContain("person@example.com");
      }
    }
  });

  it("returns ok: true and logs without the email for an already-confirmed account", async () => {
    resend.mockResolvedValue({
      data: null,
      error: {
        message: "Email already confirmed",
        code: "email_already_confirmed",
        status: 400,
      },
    });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ code: "email_already_confirmed", status: 400 }),
    );
  });

  it("returns ok: true and logs for an unrecognized error code", async () => {
    resend.mockResolvedValue({
      data: null,
      error: { message: "Something odd", code: "some_future_code", status: 418 },
    });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(console.error).toHaveBeenCalled();
  });

  it("returns a backend error for over_email_send_rate_limit", async () => {
    resend.mockResolvedValue({
      data: null,
      error: {
        message: "Email rate limit exceeded",
        code: "over_email_send_rate_limit",
        status: 400,
      },
    });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: { type: "backend", message: "Email rate limit exceeded" },
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns a backend error for over_request_rate_limit", async () => {
    resend.mockResolvedValue({
      data: null,
      error: {
        message: "Too many requests",
        code: "over_request_rate_limit",
        status: 400,
      },
    });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: { type: "backend", message: "Too many requests" },
    });
  });

  it("returns a backend error for a plain 429 status with no known code", async () => {
    resend.mockResolvedValue({
      data: null,
      error: { message: "Rate limited", status: 429 },
    });

    const result = await resendVerificationEmail({
      email: "person@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: { type: "backend", message: "Rate limited" },
    });
  });
});
