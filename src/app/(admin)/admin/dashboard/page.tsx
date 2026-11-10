import { Suspense } from "react";
import { requireRole } from "@/features/auth";

async function AdminDashboard() {
  // Admin area policy (admin + manager) is pending team confirmation.
  await requireRole(["admin", "manager"]);

  return <h1>Admin dashboard</h1>;
}

export default function AdminDashboardPage() {
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
