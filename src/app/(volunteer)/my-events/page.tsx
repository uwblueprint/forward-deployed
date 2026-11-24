import { EmptyState } from "@/components/common/states";

// Placeholder so the nav link resolves; the My events screen is built separately.
export default function MyEventsPage() {
  return (
    <>
      <h1 className="sr-only">My events</h1>
      <EmptyState title="My events is coming soon" description="Check back shortly." />
    </>
  );
}
