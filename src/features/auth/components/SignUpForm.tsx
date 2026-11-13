"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/forms";
import { fieldError } from "../api/fieldError";
import { signUpAction, type SignUpActionState } from "../api/actions";

const initialState: SignUpActionState = { status: "idle" };

export function SignUpForm() {
  // Email and name fields are controlled so they survive React 19's
  // post-action form reset after a failed submit. Password is deliberately
  // uncontrolled so it's cleared, not repopulated. Don't make it controlled.
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
        <FormField
          label="First name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={firstNameError}
        />
        <FormField
          label="Last name"
          name="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={lastNameError}
        />
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
          autoComplete="new-password"
          error={passwordError}
        />
        {state.status === "error" && state.message && (
          <p role="alert">{state.message}</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <Link href="/login">Already have an account? Log in</Link>
    </div>
  );
}
