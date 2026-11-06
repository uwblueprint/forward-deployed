import { Suspense } from "react";
import { requireRole } from "@/features/auth";

async function VolunteerDashboard() {
  await requireRole("volunteer");

  return <h1>Volunteer dashboard</h1>;
}

export default function VolunteerDashboardPage() {
  return (
    <Suspense>
      <VolunteerDashboard />
    </Suspense>
  );
}
