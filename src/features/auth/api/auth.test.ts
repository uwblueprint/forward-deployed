import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      signInWithPassword,
      signUp,
      signOut: signOutMock,
    },
  })),
}));

import { signInWithEmail, signOut, signUpWithEmail } from "./auth";

beforeEach(() => {
  signInWithPassword.mockReset();
  signUp.mockReset();
  signOutMock.mockReset();
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
