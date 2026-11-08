"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requestPasswordReset,
  signOut,
  updatePassword,
  verifyResetCode,
} from "./auth";
import type { AuthResult } from "./auth";

/** Server Action wrapper so Client Components (e.g. the account menu) can sign out. */
export async function signOutAction(): Promise<AuthResult<null>> {
  return signOut();
}
import {
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  updatePassword,
  verifyResetCode,
} from "./auth";

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
 * TODO(FOR-38, PR #22): replace this inline query with `getUserRole` once
 * the role-model work merges. Fail-closed: a missing row or any role other
 * than admin/manager sends the user to /dashboard, never /admin/dashboard.
 */
async function resolveSignInRedirect(userId: string): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return "/dashboard";
  }

  return data.role === "admin" || data.role === "manager"
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

  const userId = result.data.user?.id;
  const redirectPath = userId
    ? await resolveSignInRedirect(userId)
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
