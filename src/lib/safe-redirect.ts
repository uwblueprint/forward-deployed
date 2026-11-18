/**
 * Only accepts a same-site path ("/foo", "/foo/bar") as a redirect target,
 * falling back otherwise. Rejects absolute URLs, protocol-relative URLs
 * ("//evil.com"), the backslash variant some browsers also treat as
 * protocol-relative ("/\evil.com"), and whitespace/control characters —
 * browsers strip tabs and newlines, so "/\t/evil.com" would otherwise
 * become protocol-relative too. Use for any `next`/redirect query param
 * read from a URL, since those are attacker-controlled.
 */
export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next) {
    return fallback;
  }

  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    /[\s\x00-\x1f]/.test(next)
  ) {
    return fallback;
  }

  return next;
}
