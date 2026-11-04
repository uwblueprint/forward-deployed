import { Suspense } from "react";
import { AdminShell } from "@/components/common/navigation";
import { requireRole } from "@/features/auth";

async function RequireRole({ children }: { children: React.ReactNode }) {
  // Admin area policy (admin + manager) is pending team confirmation.
  await requireRole(["admin", "manager"]);

  return children;
}

// Server component: route-level auth checks belong here, not inside AdminShell.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <RequireRole>
        <AdminShell>{children}</AdminShell>
      </RequireRole>
    </Suspense>
  );
}
