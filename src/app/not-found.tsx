import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

// App-wide 404 for URLs that match no route.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-16">
      <EmptyState
        icon={SearchXIcon}
        titleAs="h1"
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={<Button nativeButton={false} render={<Link href="/" />}>Go home</Button>}
      />
    </main>
  );
}
