"use server";

import { signOut } from "./auth";
import type { AuthResult } from "./auth";

/** Server Action wrapper so Client Components (e.g. the account menu) can sign out. */
export async function signOutAction(): Promise<AuthResult<null>> {
  return signOut();
}
