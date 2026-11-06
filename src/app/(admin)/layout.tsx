import { Suspense } from "react";
import { requireRole } from "@/features/auth";

async function RequireRole({ children }: { children: React.ReactNode }) {
  // Admin area policy (admin + manager) is pending team confirmation.
  await requireRole(["admin", "manager"]);

  return (
    <>
      <p>Admin area</p>
      {children}
    </>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Suspense>
        <RequireRole>{children}</RequireRole>
      </Suspense>
    </div>
  );
}
