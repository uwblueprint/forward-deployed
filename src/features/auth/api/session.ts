import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";

export type Role = "admin" | "volunteer";

export type RoleResolver = (user: User) => Promise<Role | null>;

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

/**
 * FOR-38 will replace this with real role storage. Until then it must
 * never grant a role, so every caller is denied until FOR-38 lands.
 */
export const getUserRole: RoleResolver = async () => null;

/**
 * Matches real URL paths, not the `(admin)`/`(volunteer)` route-group
 * folder names those paths render through.
 */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function requireRole(
  role: Role,
  resolveRole: RoleResolver = getUserRole,
) {
  const user = await requireUser();
  const resolvedRole = await resolveRole(user);

  if (resolvedRole !== role) {
    notFound();
  }

  return user;
}
