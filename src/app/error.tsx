"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";

// Last-resort boundary for routes without their own error.tsx. Logs, never shows,
// the thrown error.
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-16">
      <ErrorState titleAs="h1" onRetry={retry} />
    </main>
  );
}
