"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetAction,
  updatePasswordAction,
  verifyResetCodeAction,
  type ResetFlowActionState,
} from "../api/actions";

const initialState: ResetFlowActionState = { status: "idle" };

function fieldError(
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

function ForgotPasswordFlowInner({
  onStartOver,
}: {
  onStartOver: () => void;
}) {
  const [email, setEmail] = useState("");

  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyResetCodeAction,
    initialState,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updatePasswordAction,
    initialState,
  );

  const step =
    verifyState.status === "success"
      ? "password"
      : requestState.status === "success"
        ? "code"
        : "email";

  if (step === "email") {
    const emailError = fieldError(requestState.fieldErrors, "email");

    return (
      <div>
        <h1>Forgot password</h1>
        <form action={requestAction}>
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
          {requestState.status === "error" && requestState.message && (
            <p>{requestState.message}</p>
          )}
          <Button type="submit" disabled={requestPending}>
            Send code
          </Button>
        </form>
      </div>
    );
  }

  if (step === "code") {
    const codeError = fieldError(verifyState.fieldErrors, "code");

    return (
      <div>
        <h1>Enter the code</h1>
        {requestState.status === "success" && <p>{requestState.message}</p>}
        <form action={verifyAction}>
          <input type="hidden" name="email" value={email} />
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? "code-error" : undefined}
          />
          {codeError && <p id="code-error">{codeError}</p>}
          {verifyState.status === "error" && verifyState.message && (
            <p>{verifyState.message}</p>
          )}
          <Button type="submit" disabled={verifyPending}>
            Verify code
          </Button>
        </form>
        <Button type="button" onClick={onStartOver}>
          Start over
        </Button>
      </div>
    );
  }

  const passwordError = fieldError(updateState.fieldErrors, "password");
  const confirmPasswordError = fieldError(
    updateState.fieldErrors,
    "confirmPassword",
  );

  return (
    <div>
      <h1>Choose a new password</h1>
      <form action={updateAction}>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
        />
        {passwordError && <p id="password-error">{passwordError}</p>}
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          aria-invalid={confirmPasswordError ? true : undefined}
          aria-describedby={
            confirmPasswordError ? "confirmPassword-error" : undefined
          }
        />
        {confirmPasswordError && (
          <p id="confirmPassword-error">{confirmPasswordError}</p>
        )}
        {updateState.status === "error" && updateState.message && (
          <p>{updateState.message}</p>
        )}
        <Button type="submit" disabled={updatePending}>
          Reset password
        </Button>
      </form>
      <Button type="button" onClick={onStartOver}>
        Start over
      </Button>
    </div>
  );
}

export function ForgotPasswordFlow() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <ForgotPasswordFlowInner
      key={resetKey}
      onStartOver={() => setResetKey((key) => key + 1)}
    />
  );
}
