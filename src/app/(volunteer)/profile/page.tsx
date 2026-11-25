import { EmptyState } from "@/components/common/states";

// Placeholder so the nav link resolves; the profile screen is built separately.
export default function ProfilePage() {
  return (
    <>
      <h1 className="sr-only">Profile</h1>
      <EmptyState title="Profile is coming soon" description="Check back shortly." />
    </>
  );
}
