import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

type ConfirmSignupOtpType = Extract<EmailOtpType, "email" | "signup">;

function isConfirmSignupOtpType(
  value: string | null,
): value is ConfirmSignupOtpType {
  return value === "email" || value === "signup";
}

/**
 * Verifies a signup-confirmation `token_hash` directly, with no code
 * verifier cookie involved, so it works in any browser, not just the one
 * the user signed up in. Only the sign-up confirmation OTP types are
 * accepted here — other types (e.g. "recovery") go through the code-based
 * password reset flow instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = getSafeRedirectPath(searchParams.get("next"), "/dashboard");

  if (!tokenHash || !isConfirmSignupOtpType(type)) {
    redirect("/auth/error?reason=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    const reason = error.code === "otp_expired" ? "expired" : "invalid";
    redirect(`/auth/error?reason=${reason}`);
  }

  redirect(next);
}
