import type { Session, User } from "@supabase/supabase-js";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
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
