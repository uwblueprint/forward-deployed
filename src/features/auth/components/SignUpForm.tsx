"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction, type SignUpActionState } from "../api/actions";

const initialState: SignUpActionState = { status: "idle" };

function fieldError(
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

export function SignUpForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div>
        <h1>Create account</h1>
        <p>{state.message}</p>
      </div>
    );
  }

  const firstNameError = fieldError(state.fieldErrors, "firstName");
  const lastNameError = fieldError(state.fieldErrors, "lastName");
  const emailError = fieldError(state.fieldErrors, "email");
  const passwordError = fieldError(state.fieldErrors, "password");

  return (
    <div>
      <h1>Create account</h1>
      <form action={formAction}>
        <Label htmlFor="firstName">First name</Label>
        <Input
          id="firstName"
          name="firstName"
          type="text"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          aria-invalid={firstNameError ? true : undefined}
          aria-describedby={firstNameError ? "firstName-error" : undefined}
        />
        {firstNameError && <p id="firstName-error">{firstNameError}</p>}
        <Label htmlFor="lastName">Last name</Label>
        <Input
          id="lastName"
          name="lastName"
          type="text"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          aria-invalid={lastNameError ? true : undefined}
          aria-describedby={lastNameError ? "lastName-error" : undefined}
        />
        {lastNameError && <p id="lastName-error">{lastNameError}</p>}
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
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <Link href="/login">Already have an account? Log in</Link>
    </div>
  );
}
