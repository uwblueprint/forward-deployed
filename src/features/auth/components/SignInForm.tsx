"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type SignInActionState } from "../api/actions";

const initialState: SignInActionState = { status: "idle" };

function fieldError(
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

export function SignInForm() {
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
        />
        {emailError && <p id="email-error">{emailError}</p>}
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
        />
        {passwordError && <p id="password-error">{passwordError}</p>}
        {state.status === "error" && state.message && <p>{state.message}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <Link href="/forgot-password">Forgot password?</Link>
      <Link href="/register">Create an account</Link>
    </div>
  );
}
