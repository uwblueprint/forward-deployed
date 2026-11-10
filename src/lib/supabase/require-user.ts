import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./server";

/**
 * Deduplicates `supabase.auth.getUser()` via React's `cache()`, which
 * shares one result across a single server component render pass. That
 * covers `requireUser()`, since a layout and its page can both call it in
 * the same render. Route handlers aren't part of a render pass, so each
 * invocation runs in its own `cache()` scope and calls `getUser()`
 * independently. That's fine: `requireRoleForRoute()` only checks once per
 * handler invocation, so there's nothing to dedupe.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/**
 * Must be called inside any server component that renders protected content,
 * before that content is created — layouts render in parallel with their
 * pages, so a check in a layout cannot gate what a page returns.
 */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
