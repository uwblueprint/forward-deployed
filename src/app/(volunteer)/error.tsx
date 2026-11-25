"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";

// Catches errors from every volunteer page. The shell (layout) stays mounted, and the
// thrown error is only logged, never shown: its message can leak internals.
export default function VolunteerError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // h1: the shell header title is not a heading, so this is the page heading.
  return <ErrorState titleAs="h1" onRetry={retry} />;
}
