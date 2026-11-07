import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/require-user";

async function AdminDashboard() {
  await requireUser();

  return <h1>Admin dashboard</h1>;
}

export default function AdminDashboardPage() {
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
