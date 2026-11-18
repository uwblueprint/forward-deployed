import { isAuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

/**
 * Exchanges a PKCE `code` for a session. Requires the code-verifier cookie
 * set in the browser that started the flow, so a link opened in a
 * different browser fails here (reason=different-browser) rather than at
 * /auth/confirm.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = getSafeRedirectPath(searchParams.get("next"), "/dashboard");

  if (searchParams.get("error")) {
    const errorCode = searchParams.get("error_code");
    const reason = errorCode === "otp_expired" ? "expired" : "invalid";
    redirect(`/auth/error?reason=${reason}`);
  }

  const code = searchParams.get("code");

  if (!code) {
    redirect("/auth/error?reason=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const reason = isAuthPKCECodeVerifierMissingError(error)
      ? "different-browser"
      : "invalid";
    redirect(`/auth/error?reason=${reason}`);
  }

  redirect(next);
}
