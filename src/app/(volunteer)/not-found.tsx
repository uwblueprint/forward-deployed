import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

// Shown inside the shell when a volunteer page calls notFound(), e.g. an unknown event id.
export default function VolunteerNotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Page not found"
      description="This page doesn't exist or is no longer available."
      action={
        <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      }
    />
  );
}
