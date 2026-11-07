import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./server";

/**
 * Must be called inside any server component that renders protected content,
 * before that content is created — layouts render in parallel with their
 * pages, so a check in a layout cannot gate what a page returns.
 */
export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
