import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser, requireUser } from "@/lib/supabase/require-user";

export type Role = "admin" | "manager" | "volunteer";

export type RoleResolver = (user: User) => Promise<Role | null>;

const KNOWN_ROLES: readonly Role[] = ["admin", "manager", "volunteer"];

function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (KNOWN_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Reads the role from the user's membership in `public.memberships` (see
 * docs/role-model.md), deduplicated per request via React's `cache()` so
 * multiple role checks in the same request issue only one query. A user who
 * hasn't joined an organization yet is a volunteer. Fail-closed: a query
 * error or an unrecognized role value resolves to null. Never reads role from
 * `app_metadata`, `user_metadata`, or JWT claims.
 */
const resolveRoleById = cache(
  async (userId: string): Promise<Role | null> => {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return null;
    }
    if (!data) {
      return "volunteer";
    }

    return isRole(data.role) ? data.role : null;
  },
);

export const getUserRole: RoleResolver = (user) => resolveRoleById(user.id);

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
 * response, so this checks the session directly via `getCurrentUser()` and
 * never redirects. Returns `{ ok: true, user }` on success, or
 * `{ ok: false, response }` with a 401 (no session) or 403
 * (missing/insufficient role) JSON response to return as-is from the
 * handler.
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
  const user = await getCurrentUser();

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
