import type { User } from "@supabase/supabase-js";
import { isAuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getUserRole } from "@/features/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

/**
 * Staff (admin/manager) go to the admin dashboard; everyone else goes to the
 * volunteer dashboard. Mirrors `resolveSignInRedirect` in
 * features/auth/api/actions.ts. Fail-closed: `getUserRole` returns null on
 * errors or unknown roles, which sends the user to /dashboard, never
 * /admin/dashboard.
 */
async function resolveCallbackRedirect(user: User): Promise<string> {
  const role = await getUserRole(user);

  return role === "admin" || role === "manager"
    ? "/admin/dashboard"
    : "/dashboard";
}

/**
 * Exchanges a PKCE `code` for a session. Requires the code-verifier cookie
 * set in the browser that started the flow, so a link opened in a
 * different browser fails here (reason=different-browser) rather than at
 * /auth/confirm.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawNext = searchParams.get("next");

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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const reason = isAuthPKCECodeVerifierMissingError(error)
      ? "different-browser"
      : "invalid";
    redirect(`/auth/error?reason=${reason}`);
  }

  if (rawNext !== null) {
    redirect(getSafeRedirectPath(rawNext, "/dashboard"));
  }

  const redirectPath = data.user
    ? await resolveCallbackRedirect(data.user)
    : "/dashboard";

  redirect(redirectPath);
}
