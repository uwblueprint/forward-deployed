import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { RedirectError, mockCookieStore } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public readonly url: string) {
      super(`redirect:${url}`);
    }
  }

  const cookies = new Map<string, { name: string; value: string }>();

  const mockCookieStore = {
    cookies,
    getAll: () => Array.from(cookies.values()),
    get: (name: string) => cookies.get(name),
    set: (name: string, value: string) => {
      cookies.set(name, { name, value });
    },
    delete: (name: string) => {
      cookies.delete(name);
    },
  };

  return { RedirectError, mockCookieStore };
});

// Real @/lib/supabase/server and @supabase/ssr are used so the PKCE exchange
// actually drives the cookie storage adapter; only the Next.js request-scoped
// APIs it depends on (cookies, connection, redirect) are faked.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn(async () => undefined),
  };
});

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { GET } from "./route";

const SUPABASE_URL = "https://test-project.supabase.co";
// Matches supabase-js's default `sb-${projectRef}-auth-token` storage key for
// this URL, which is also where the PKCE code verifier is filed.
const STORAGE_KEY = "sb-test-project-auth-token";
const VERIFIER_COOKIE_NAME = `${STORAGE_KEY}-code-verifier`;
const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/;

function makeRequest(query: string) {
  return new NextRequest(`https://example.com/auth/callback${query}`);
}

// Pre-seeds the verifier cookie exactly as @supabase/ssr's cookie storage
// adapter would have written it when the flow started: auth-js JSON-stringifies
// the value, then the adapter base64url-encodes it behind a "base64-" marker.
function seedCodeVerifierCookie(verifier = "test-pkce-code-verifier-value") {
  const encoded = `base64-${Buffer.from(JSON.stringify(verifier)).toString("base64url")}`;
  mockCookieStore.set(VERIFIER_COOKIE_NAME, encoded);
}

function authSessionCookies() {
  return mockCookieStore
    .getAll()
    .filter(({ name, value }) => AUTH_COOKIE_PATTERN.test(name) && value !== "");
}

// Reassembles the session cookie exactly as @supabase/ssr wrote it: a single
// cookie named STORAGE_KEY, or — once the encoded value exceeds the chunk
// size — chunks named `${STORAGE_KEY}.0`, `${STORAGE_KEY}.1`, etc. joined in
// order. Either way the value is "base64-" + base64url(JSON.stringify(session)).
function decodeAuthSessionCookie(cookies: { name: string; value: string }[]) {
  const base = cookies.find(({ name }) => name === STORAGE_KEY);
  const raw = base
    ? base.value
    : cookies
        .filter(({ name }) => name.startsWith(`${STORAGE_KEY}.`))
        .map(({ name, value }) => ({
          index: Number(name.slice(STORAGE_KEY.length + 1)),
          value,
        }))
        .sort((a, b) => a.index - b.index)
        .map(({ value }) => value)
        .join("");

  const decoded = raw.startsWith("base64-")
    ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
    : raw;

  return JSON.parse(decoded);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeSessionBody() {
  return {
    access_token: "access-token-value",
    refresh_token: "refresh-token-value",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "person@example.com",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}

beforeEach(() => {
  mockCookieStore.cookies.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test_key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /auth/callback (cookie-level integration)", () => {
  it("exchanges a valid PKCE code for a session and sets the auth session cookie", async () => {
    seedCodeVerifierCookie();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        if (href.includes("/token?grant_type=pkce")) {
          return jsonResponse(fakeSessionBody());
        }
        throw new Error(`unexpected fetch call: ${href}`);
      }),
    );

    await expect(
      GET(makeRequest("?code=valid-code&next=/settings")),
    ).rejects.toThrow(RedirectError);

    expect(redirect).toHaveBeenCalledWith("/settings");
    expect(authSessionCookies().length).toBeGreaterThan(0);

    const session = decodeAuthSessionCookie(authSessionCookies());
    expect(session.access_token).toBe("access-token-value");
  });

  it("rejects an invalid/expired code, redirects to /auth/error, and sets no session cookie", async () => {
    seedCodeVerifierCookie();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        if (href.includes("/token?grant_type=pkce")) {
          return jsonResponse(
            {
              error: "invalid_grant",
              error_code: "bad_code_verifier",
              msg: "Invalid code",
            },
            400,
          );
        }
        throw new Error(`unexpected fetch call: ${href}`);
      }),
    );

    await expect(GET(makeRequest("?code=invalid-code"))).rejects.toThrow(
      RedirectError,
    );

    expect(redirect).toHaveBeenCalledWith("/auth/error?reason=invalid");
    expect(authSessionCookies()).toHaveLength(0);
  });
});
