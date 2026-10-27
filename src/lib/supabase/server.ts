import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use on the server (Server Components, Server
 * Actions, and Route Handlers), backed by the Next.js `cookies()` store so it
 * shares the same session as the browser helper in
 * `src/lib/supabase/client.ts`.
 *
 * Must be called fresh per request (it awaits `cookies()` internally) — do
 * not cache or reuse an instance across requests.
 *
 * Cookie-write limitation: Next.js only allows writing cookies from a Server
 * Action or Route Handler, not from a Server Component render. When this
 * client is used in a Server Component, `setAll` below will throw on every
 * call; that throw is caught and ignored so rendering isn't interrupted. In
 * practice this means a Server Component can reliably *read* the session
 * (e.g. to render based on the current user) but cannot refresh/persist an
 * updated session cookie — do that from a Server Action or Route Handler
 * instead.
 *
 * To read the current user or session:
 *
 * ```ts
 * const supabase = await createServerSupabaseClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * const { data: { session } } = await supabase.auth.getSession();
 * ```
 *
 * On the server, use `getUser()` — not `getSession()` — for any
 * authorization decision. `getUser()` revalidates the session against
 * Supabase's auth server, while `getSession()` only reads the (possibly
 * stale or tampered) session cookie without verifying it.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component, where cookie writes aren't
            // allowed. Safe to ignore: session refresh happens via a Server
            // Action/Route Handler/middleware instead.
          }
        },
      },
    },
  );
}
