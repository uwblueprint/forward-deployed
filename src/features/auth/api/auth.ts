import type { Session, User } from "@supabase/supabase-js";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyResetCodeSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyResetCodeInput,
} from "../schemas/authSchema";

export type AuthError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "backend"; message: string };

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError };

export type AuthSessionData = {
  user: User | null;
  session: Session | null;
};

function validationError(fieldErrors: Record<string, string[]>): AuthError {
  return { type: "validation", fieldErrors };
}

function backendError(message: string): AuthError {
  return { type: "backend", message };
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 */
export async function signInWithEmail(
  input: LoginInput,
): Promise<AuthResult<AuthSessionData>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(z.flattenError(parsed.error).fieldErrors),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: backendError(error.message) };
  }

  return { ok: true, data: { user: data.user, session: data.session } };
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 */
export async function signUpWithEmail(
  input: RegisterInput,
  options?: { emailRedirectTo?: string },
): Promise<AuthResult<AuthSessionData>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(z.flattenError(parsed.error).fieldErrors),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      ...(options?.emailRedirectTo
        ? { emailRedirectTo: options.emailRedirectTo }
        : {}),
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });

  if (error) {
    return { ok: false, error: backendError(error.message) };
  }

  return { ok: true, data: { user: data.user, session: data.session } };
}

const RATE_LIMIT_CODES = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

function isRateLimitError(error: { code?: string; status?: number }): boolean {
  return (
    (error.code !== undefined && RATE_LIMIT_CODES.has(error.code)) ||
    error.status === 429
  );
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Unlike `requestPasswordReset`'s `resetPasswordForEmail`, Supabase's
 * `resend` can return account-revealing errors (e.g. `user_not_found`, or an
 * already-confirmed account). Only rate-limit errors are surfaced; every
 * other error is logged (code/status only, never the email) and swallowed
 * so the response is identical whether or not the account exists.
 */
export async function resendVerificationEmail(
  input: ResendVerificationInput,
  options?: { emailRedirectTo?: string },
): Promise<AuthResult<null>> {
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(z.flattenError(parsed.error).fieldErrors),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    ...(options?.emailRedirectTo
      ? { options: { emailRedirectTo: options.emailRedirectTo } }
      : {}),
  });

  if (error) {
    if (isRateLimitError(error)) {
      return { ok: false, error: backendError(error.message) };
    }
    console.error("resendVerificationEmail suppressed error", {
      code: error.code,
      status: error.status,
    });
  }

  return { ok: true, data: null };
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 */
export async function signOut(): Promise<AuthResult<null>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: backendError(error.message) };
  }

  return { ok: true, data: null };
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Supabase's `resetPasswordForEmail` doesn't reveal whether an account
 * exists for the email either way, so any error it does return is a real
 * failure (e.g. rate limiting), not an account-existence signal — safe to
 * surface without enabling account discovery.
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<AuthResult<null>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(z.flattenError(parsed.error).fieldErrors),
    };
  }

  const supabase = await createServerSupabaseClient();
  // No redirectTo: this is the code-based flow (the email contains {{ .Token }}
  // and the user types it in), so there's no link to redirect from. If a
  // link-based reset is added later, pass redirectTo pointing at /auth/confirm
  // and allow the "recovery" type there.
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
  );

  if (error) {
    return { ok: false, error: backendError(error.message) };
  }

  return { ok: true, data: null };
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * `verifyOtp` with `type: "recovery"` both checks the code and signs the
 * user in, establishing the session `updatePassword` relies on.
 */
export async function verifyResetCode(
  input: VerifyResetCodeInput,
): Promise<AuthResult<AuthSessionData>> {
  const parsed = verifyResetCodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(z.flattenError(parsed.error).fieldErrors),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "recovery",
  });

  if (error) {
    return { ok: false, error: backendError(error.message) };
  }

  return { ok: true, data: { user: data.user, session: data.session } };
}

/**
 * Plain server-side function — not a Server Action. Call it from inside a
 * Server Action or Route Handler; do not add "use server" to this file.
 *
 * Requires an existing session, established by `verifyResetCode`.
 */
export async function updatePassword(
  input: ResetPasswordInput,
): Promise<AuthResult<null>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(z.flattenError(parsed.error).fieldErrors),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: backendError(error.message) };
  }

  return { ok: true, data: null };
}
