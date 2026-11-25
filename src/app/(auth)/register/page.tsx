import { Suspense } from "react";
import { SignUpForm } from "@/features/auth";

async function RegisterForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignUpForm next={next} />;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense>
      <RegisterForm searchParams={searchParams} />
    </Suspense>
  );
}
