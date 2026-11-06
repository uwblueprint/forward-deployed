import { Suspense } from "react";
import { requireRole } from "@/features/auth";

async function AdminDashboard() {
  await requireRole("admin");

  return <h1>Admin dashboard</h1>;
}

export default function AdminDashboardPage() {
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
