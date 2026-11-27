import type { User } from "@supabase/supabase-js";
import { getUserRole } from "./requireRole";

/**
 * Staff (admin/manager) go to the admin dashboard; everyone else goes to the
 * volunteer dashboard. Fail-closed: `getUserRole` returns null on errors or
 * unknown roles, which sends the user to /dashboard, never /admin/dashboard.
 */
export async function resolveRoleRedirect(user: User): Promise<string> {
  const role = await getUserRole(user);

  return role === "admin" || role === "manager"
    ? "/admin/dashboard"
    : "/dashboard";
}
