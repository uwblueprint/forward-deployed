import { Suspense } from "react";
import Link from "next/link";
import { resolveErrorMessage } from "./messages";

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return <p>{resolveErrorMessage(reason)}</p>;
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  return (
    <div>
      <Suspense>
        <ErrorMessage searchParams={searchParams} />
      </Suspense>
      <Link href="/login">Back to login</Link>
    </div>
  );
}
