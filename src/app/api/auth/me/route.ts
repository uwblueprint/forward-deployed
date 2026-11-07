import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// The protected route handler FOR-27 required as proof that route handlers
// enforce sessions server-side, and available for client components that
// need the current user.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ id: user.id, email: user.email });
}
