"use server";

import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
  verifyResetCode,
} from "./auth";
import type { AuthResult } from "./auth";
import { getUserRole } from "./requireRole";

/** Server Action wrapper so Client Components (e.g. the account menu) can sign out. */
export async function signOutAction(): Promise<AuthResult<null>> {
  return signOut();
}

export type ResetFlowActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type SignInActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type SignUpActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function isLocalhost(host: string): boolean {
  const hostname = host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Browsers send `Origin` on same-origin POSTs (including Server Action
 * submissions), so prefer it. Fall back to `host` + `x-forwarded-proto`
 * only when it's missing, guessing "http" for localhost since
 * `x-forwarded-proto` is typically only set behind a proxy. Returns
 * undefined if there's no host to build from at all, rather than
 * constructing a malformed URL.
 */
function resolveOrigin(
  headersList: Awaited<ReturnType<typeof headers>>,
): string | undefined {
  const origin = headersList.get("origin");
  if (origin) {
    return origin;
  }

  const host = headersList.get("host");
  if (!host) {
    return undefined;
  }

  const protocol =
    headersList.get("x-forwarded-proto") ??
    (isLocalhost(host) ? "http" : "https");

  return `${protocol}://${host}`;
}

/**
 * Staff (admin/manager) go to the admin dashboard; everyone else goes to the
 * volunteer dashboard. Fail-closed: `getUserRole` returns null on errors or
 * unknown roles, which sends the user to /dashboard, never /admin/dashboard.
 */
async function resolveSignInRedirect(user: User): Promise<string> {
  const role = await getUserRole(user);

  return role === "admin" || role === "manager"
    ? "/admin/dashboard"
    : "/dashboard";
}

export async function requestPasswordResetAction(
  _prevState: ResetFlowActionState,
  formData: FormData,
): Promise<ResetFlowActionState> {
  const result = await requestPasswordReset({
    email: String(formData.get("email") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  return {
    status: "success",
    message: "If an account exists for that email, we've sent a code.",
  };
}

export async function verifyResetCodeAction(
  _prevState: ResetFlowActionState,
  formData: FormData,
): Promise<ResetFlowActionState> {
  const result = await verifyResetCode({
    email: String(formData.get("email") ?? ""),
    code: String(formData.get("code") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  return { status: "success" };
}

export async function updatePasswordAction(
  _prevState: ResetFlowActionState,
  formData: FormData,
): Promise<ResetFlowActionState> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Your reset session has expired. Start over.",
    };
  }

  const result = await updatePassword({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  redirect("/dashboard");
}

export async function signInAction(
  _prevState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const result = await signInWithEmail({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  const user = result.data.user;
  const redirectPath = user
    ? await resolveSignInRedirect(user)
    : "/dashboard";

  redirect(redirectPath);
}

export async function signUpAction(
  _prevState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const headersList = await headers();
  const origin = resolveOrigin(headersList);

  const result = await signUpWithEmail(
    {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    origin
      ? { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` }
      : undefined,
  );

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  if (result.data.session) {
    redirect("/dashboard");
  }

  return {
    status: "success",
    message: "Check your email to confirm your account.",
  };
}