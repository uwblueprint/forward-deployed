"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/forms";
import { fieldError } from "../api/fieldError";
import { signInAction, type SignInActionState } from "../api/actions";

const initialState: SignInActionState = { status: "idle" };

export function SignInForm() {
  // Email is controlled so it survives React 19's
  // post-action form reset after a failed submit. Password is deliberately
  // uncontrolled so it's cleared, not repopulated. Don't make it controlled.
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  const emailError = fieldError(state.fieldErrors, "email");
  const passwordError = fieldError(state.fieldErrors, "password");

  return (
    <div>
      <h1>Log in</h1>
      <form action={formAction}>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={passwordError}
        />
        {state.status === "error" && state.message && (
          <p role="alert">{state.message}</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <Link href="/forgot-password">Forgot password?</Link>
      <Link href="/register">Create an account</Link>
    </div>
  );
}
