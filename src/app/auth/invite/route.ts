import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getUserRole } from "@/features/auth";
import { redeemInvite, type RedeemInviteReason } from "@/features/team";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

/**
 * Staff (admin/manager) go to the admin dashboard; everyone else goes to the
 * volunteer dashboard. Mirrors `resolveCallbackRedirect` in
 * app/auth/callback/route.ts. Fail-closed: `getUserRole` returns null on
 * errors or unknown roles, which sends the user to /dashboard, never
 * /admin/dashboard.
 */
async function resolveInviteRedirect(user: User): Promise<string> {
  const role = await getUserRole(user);

  return role === "admin" || role === "manager"
    ? "/admin/dashboard"
    : "/dashboard";
}

const ERROR_REASONS: Record<RedeemInviteReason | "unauthenticated", string> = {
  "not-found": "invalid",
  unauthenticated: "invalid",
  expired: "invite-expired",
  revoked: "invite-revoked",
  used: "invite-used",
  "wrong-email": "invite-wrong-email",
  "unconfirmed-email": "invite-unconfirmed-email",
  "already-member": "invite-already-member",
};

/**
 * Opens an invite link (`?token=...`). A signed-out visitor is sent to
 * /login with `next` pointing back here, so they land back on this route
 * and redeem the invite once they've signed in or signed up. A signed-in
 * visitor redeems immediately.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    redirect("/auth/error?reason=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Encode the token before it goes into the invite path (it may contain
    // characters like & or + that would otherwise corrupt that path's own
    // query string), then encode the whole resulting path again when it's
    // embedded as /login's `next` value.
    const invitePath = `/auth/invite?token=${encodeURIComponent(token)}`;
    const returnPath = getSafeRedirectPath(invitePath, "/dashboard");
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }

  const result = await redeemInvite(token);
  if (!result.ok) {
    redirect(`/auth/error?reason=${ERROR_REASONS[result.reason]}`);
  }

  redirect(await resolveInviteRedirect(user));
}
