const PREVIEW_HOSTNAME = /^forward-deployed-[a-z0-9-]+-forward-deployed\.vercel\.app$/;

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Checks a request-derived origin (e.g. from `resolveOrigin`) against the
 * same allowlist configured in Supabase's Redirect URLs, as a second line
 * of defense: `Origin`/`Host` headers are attacker-controlled, and this
 * repo's only other check is Supabase's own dashboard allowlist, which
 * isn't verifiable from code. Matches hostnames exactly (never a substring
 * check) so a lookalike like `forward-deployed.vercel.app.evil.com` can't
 * pass.
 */
export function isAllowedOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  // Reject anything with a path, query, or embedded userinfo (e.g.
  // "https://forward-deployed.vercel.app@evil.com") that wouldn't survive
  // being re-serialized as a bare origin — this value gets concatenated
  // directly into a redirect URL downstream.
  if (url.origin !== origin) {
    return false;
  }

  if (url.protocol === "http:" && isLocalHostname(url.hostname)) {
    return true;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  return (
    url.hostname === "forward-deployed.vercel.app" ||
    PREVIEW_HOSTNAME.test(url.hostname)
  );
}
