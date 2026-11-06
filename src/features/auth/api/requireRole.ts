import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/require-user";

export type Role = "admin" | "volunteer";

export type RoleResolver = (user: User) => Promise<Role | null>;

/**
 * Fail-closed placeholder until FOR-21's role reader replaces it. Until
 * then it must never grant a role, so every caller is denied.
 */
export const getUserRole: RoleResolver = async () => null;

function isAllowed(role: Role | null, allowed: Role | Role[]): boolean {
  if (role === null) {
    return false;
  }

  return Array.isArray(allowed) ? allowed.includes(role) : role === allowed;
}

/**
 * Call inside a server component (page or layout) that renders protected
 * content, before that content is created. Redirects to `/login` if there
 * is no session, and calls `notFound()` if the resolved role isn't one of
 * `allowed`. Layouts can't gate their pages, so every page reading
 * protected data must call this itself even when an ancestor layout
 * already does.
 *
 * ```ts
 * async function ProtectedReport() {
 *   await requireRole("admin");
 *   const report = await getReport(); // created only after the check
 *   return <Report data={report} />;
 * }
 * ```
 */
export async function requireRole(
  allowed: Role | Role[],
  resolveRole: RoleResolver = getUserRole,
) {
  const user = await requireUser();
  const role = await resolveRole(user);

  if (!isAllowed(role, allowed)) {
    notFound();
  }

  return user;
}

/**
 * Call inside a route handler serving protected data. `redirect`/`notFound`
 * throw navigation errors meant for page rendering, which don't fit an API
 * response, so this checks the session directly with
 * `createServerSupabaseClient().auth.getUser()` and never redirects.
 * Returns `{ ok: true, user }` on success, or `{ ok: false, response }`
 * with a 401 (no session) or 403 (missing/insufficient role) JSON response
 * to return as-is from the handler.
 *
 * ```ts
 * export async function GET() {
 *   const result = await requireRoleForRoute("admin");
 *   if (!result.ok) return result.response;
 *   const report = await getReport(); // created only after the check
 *   return NextResponse.json(report);
 * }
 * ```
 */
export async function requireRoleForRoute(
  allowed: Role | Role[],
  resolveRole: RoleResolver = getUserRole,
): Promise<{ ok: true; user: User } | { ok: false; response: NextResponse }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = await resolveRole(user);

  if (!isAllowed(role, allowed)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
