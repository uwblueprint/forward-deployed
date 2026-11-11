import { Suspense } from "react";
import Link from "next/link";

type Reason = "expired" | "different-browser" | "invalid";

const MESSAGES: Record<Reason, string> = {
  expired:
    "This link has expired or has already been used. Sign up again, or request a new link.",
  "different-browser":
    "This link only works in the browser you signed up in. Open it there instead.",
  invalid: "This link is invalid.",
};

function isReason(value: string | undefined): value is Reason {
  return (
    value === "expired" || value === "different-browser" || value === "invalid"
  );
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = isReason(reason) ? MESSAGES[reason] : MESSAGES.invalid;

  return <p>{message}</p>;
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
