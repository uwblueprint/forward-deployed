const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

/**
 * Matches real URL paths, not the `(admin)`/`(volunteer)` route-group
 * folder names those paths render through.
 */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
