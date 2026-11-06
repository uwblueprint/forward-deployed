import { Suspense } from "react";
import { requireRole } from "@/features/auth";

async function RequireRole({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

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
