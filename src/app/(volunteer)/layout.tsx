import { Suspense } from "react";
import { requireRole } from "@/features/auth";

async function RequireRole({ children }: { children: React.ReactNode }) {
  // Volunteer area policy (volunteer only) is pending team confirmation.
  await requireRole("volunteer");

  return (
    <>
      <p>Volunteer area</p>
      {children}
    </>
  );
}

export default function VolunteerLayout({
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
