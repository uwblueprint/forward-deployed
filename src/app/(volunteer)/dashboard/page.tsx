import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/require-user";

async function VolunteerDashboard() {
  await requireUser();

  return <h1>Volunteer dashboard</h1>;
}

export default function VolunteerDashboardPage() {
  return (
    <Suspense>
      <VolunteerDashboard />
    </Suspense>
  );
}
