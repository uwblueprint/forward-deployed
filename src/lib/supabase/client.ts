import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in the browser (Client Components, event
 * handlers, effects, etc.).
 *
 * The client reads/writes the Supabase session via browser cookies
 * automatically, so it stays in sync with the server helper in
 * `src/lib/supabase/server.ts` as long as both are used on the same domain.
 *
 * To read the current user or session:
 *
 * ```ts
 * const supabase = createBrowserSupabaseClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * const { data: { session } } = await supabase.auth.getSession();
 * ```
 *
 * Call this once per component/module as needed — it is cheap to construct.
 * Do not use this helper in Server Components, Server Actions, or Route
 * Handlers; use `createServerSupabaseClient` from `./server` there instead.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
