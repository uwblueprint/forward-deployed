import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import {
  AccountMenu,
  VolunteerShell,
  accountIdentity,
} from "@/components/common/navigation";
import { requireRole, signOutAction } from "@/features/auth";
import { getCurrentUser } from "@/lib/supabase/require-user";

async function RequireRole({ children }: { children: React.ReactNode }) {
  // Volunteer area policy (volunteer only) is pending team confirmation.
  await requireRole("volunteer");

  return children;
}

// Cached per request, so this reuses the lookup requireRole already made.
async function VolunteerAccount() {
  const user = await getCurrentUser();
  if (!user) return null;

  return <AccountMenu {...accountIdentity(user)} onSignOut={signOutAction} />;
}

// Server component: route-level auth checks belong here, not inside VolunteerShell.
// Loading, error, and not-found UI for every volunteer page lives beside this file
// (loading.tsx, error.tsx, not-found.tsx) and renders inside the shell.
export default function VolunteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // loading.tsx sits inside this layout, so it cannot cover the auth check itself.
    <Suspense fallback={<LoadingState />}>
      <RequireRole>
        <VolunteerShell account={<VolunteerAccount />}>{children}</VolunteerShell>
      </RequireRole>
    </Suspense>
  );
}
