import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserRole, signInWithEmail, signUpWithEmail, RedirectError } =
  vi.hoisted(() => {
    class RedirectError extends Error {
      constructor(public readonly url: string) {
        super(`redirect:${url}`);
      }
    }

    return {
      getUserRole: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      RedirectError,
    };
  });

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({})),
}));

vi.mock("./auth", () => ({
  signInWithEmail,
  signUpWithEmail,
}));

vi.mock("./requireRole", () => ({
  getUserRole,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

const mockHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => mockHeaders.get(key.toLowerCase()) ?? null,
  })),
}));

import { redirect } from "next/navigation";
import { signInAction, signUpAction } from "./actions";

function makeFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaders.clear();
});

describe("signInAction", () => {
  it("returns field errors on validation failure", async () => {
    signInWithEmail.mockResolvedValue({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: { email: ["Enter a valid email address."] },
      },
    });

    const result = await signInAction(
      { status: "idle" },
      makeFormData({ email: "not-an-email", password: "x" }),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { email: ["Enter a valid email address."] },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns the backend message on sign-in failure", async () => {
    signInWithEmail.mockResolvedValue({
      ok: false,
      error: { type: "backend", message: "Invalid login credentials" },
    });

    const result = await signInAction(
      { status: "idle" },
      makeFormData({ email: "person@example.com", password: "wrong" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Invalid login credentials",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects admins to /admin/dashboard", async () => {
    const user = { id: "user-1" };
    signInWithEmail.mockResolvedValue({
      ok: true,
      data: { user, session: {} },
    });
    getUserRole.mockResolvedValue("admin");

    await expect(
      signInAction(
        { status: "idle" },
        makeFormData({ email: "admin@example.com", password: "password123" }),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
    expect(getUserRole).toHaveBeenCalledWith(user);
  });

  it("redirects managers to /admin/dashboard", async () => {
    signInWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-2" }, session: {} },
    });
    getUserRole.mockResolvedValue("manager");

    await expect(
      signInAction(
        { status: "idle" },
        makeFormData({
          email: "manager@example.com",
          password: "password123",
        }),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("redirects volunteers to /dashboard", async () => {
    signInWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-3" }, session: {} },
    });
    getUserRole.mockResolvedValue("volunteer");

    await expect(
      signInAction(
        { status: "idle" },
        makeFormData({
          email: "volunteer@example.com",
          password: "password123",
        }),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("fails closed to /dashboard when getUserRole returns null", async () => {
    signInWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-4" }, session: {} },
    });
    getUserRole.mockResolvedValue(null);

    await expect(
      signInAction(
        { status: "idle" },
        makeFormData({ email: "person@example.com", password: "password123" }),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /dashboard without calling getUserRole when sign-in returns no user", async () => {
    signInWithEmail.mockResolvedValue({
      ok: true,
      data: { user: null, session: {} },
    });

    await expect(
      signInAction(
        { status: "idle" },
        makeFormData({ email: "person@example.com", password: "password123" }),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
    expect(getUserRole).not.toHaveBeenCalled();
  });
});

describe("signUpAction", () => {
  it("returns field errors on validation failure", async () => {
    signUpWithEmail.mockResolvedValue({
      ok: false,
      error: {
        type: "validation",
        fieldErrors: { email: ["Enter a valid email address."] },
      },
    });

    const result = await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "not-an-email",
        password: "short",
      }),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { email: ["Enter a valid email address."] },
    });
  });

  it("returns the backend message on sign-up failure", async () => {
    signUpWithEmail.mockResolvedValue({
      ok: false,
      error: { type: "backend", message: "User already registered" },
    });

    const result = await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: "User already registered",
    });
  });

  it("passes the names, email, password, and an emailRedirectTo built from the origin header", async () => {
    mockHeaders.set("origin", "https://forward-deployed.vercel.app");
    signUpWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-1" }, session: null },
    });

    await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      }),
    );

    expect(signUpWithEmail).toHaveBeenCalledWith(
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      },
      {
        emailRedirectTo:
          "https://forward-deployed.vercel.app/auth/callback?next=/dashboard",
      },
    );
  });

  it("falls back to host + x-forwarded-proto when origin is missing", async () => {
    mockHeaders.set("x-forwarded-proto", "https");
    mockHeaders.set("host", "forward-deployed.vercel.app");
    signUpWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-1" }, session: null },
    });

    await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      }),
    );

    expect(signUpWithEmail).toHaveBeenCalledWith(expect.anything(), {
      emailRedirectTo:
        "https://forward-deployed.vercel.app/auth/callback?next=/dashboard",
    });
  });

  it("defaults to http for a localhost host with no x-forwarded-proto", async () => {
    mockHeaders.set("host", "localhost:3000");
    signUpWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-1" }, session: null },
    });

    await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      }),
    );

    expect(signUpWithEmail).toHaveBeenCalledWith(expect.anything(), {
      emailRedirectTo: "http://localhost:3000/auth/callback?next=/dashboard",
    });
  });

  it("omits emailRedirectTo when no origin or host can be determined", async () => {
    signUpWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-1" }, session: null },
    });

    await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      }),
    );

    expect(signUpWithEmail).toHaveBeenCalledWith(
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      },
      undefined,
    );
  });

  it("redirects to /dashboard when sign-up establishes a session", async () => {
    signUpWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-1" }, session: { access_token: "token" } },
    });

    await expect(
      signUpAction(
        { status: "idle" },
        makeFormData({
          firstName: "Jane",
          lastName: "Doe",
          email: "new@example.com",
          password: "password123",
        }),
      ),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a check-your-email success state when there is no session", async () => {
    signUpWithEmail.mockResolvedValue({
      ok: true,
      data: { user: { id: "user-1" }, session: null },
    });

    const result = await signUpAction(
      { status: "idle" },
      makeFormData({
        firstName: "Jane",
        lastName: "Doe",
        email: "new@example.com",
        password: "password123",
      }),
    );

    expect(result).toEqual({
      status: "success",
      message: "Check your email to confirm your account.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
