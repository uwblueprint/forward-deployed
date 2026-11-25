import { EmptyState } from "@/components/common/states";

// Placeholder so the nav link resolves; the events screen is built separately.
export default function VolunteerEventsPage() {
  return (
    <>
      <h1 className="sr-only">Events</h1>
      <EmptyState title="Events are coming soon" description="Check back shortly." />
    </>
  );
}
