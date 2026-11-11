import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOutMock = vi.fn();
const resetPasswordForEmail = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      signInWithPassword,
      signUp,
      signOut: signOutMock,
      resetPasswordForEmail,
      verifyOtp,
      updateUser,
    },
  })),
}));

import {
  requestPasswordReset,
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
