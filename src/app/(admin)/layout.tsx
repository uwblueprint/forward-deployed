import { Suspense } from "react";
import { AccountMenu, AdminShell } from "@/components/common/navigation";
import { getUserRole, requireRole, signOutAction } from "@/features/auth";
import { getCurrentUser } from "@/lib/supabase/require-user";

async function AdminArea({ children }: { children: React.ReactNode }) {
  // Admin area policy (admin + manager) is pending team confirmation.
  const user = await requireRole(["admin", "manager"]);
  // Cached per request, so this reuses requireRole's lookup.
  const role = await getUserRole(user);

  return (
    <AdminShell account={<AdminAccount />} isAdmin={role === "admin"}>
      {children}
    </AdminShell>
  );
}

// Cached per request, so this reuses the lookup requireRole already made.
async function AdminAccount() {
  const user = await getCurrentUser();
  if (!user) return null;

  const email = user.email ?? "";
  const fullName = user.user_metadata?.full_name;
  const name =
    typeof fullName === "string" && fullName.trim()
      ? fullName
      : email.split("@")[0] || "Account";

  return <AccountMenu name={name} email={email} onSignOut={signOutAction} />;
}

// Server component: route-level auth checks belong here, not inside AdminShell.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <AdminArea>{children}</AdminArea>
    </Suspense>
  );
}
