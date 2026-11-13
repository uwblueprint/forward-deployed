"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/forms";
import { fieldError } from "../api/fieldError";
import {
  requestPasswordResetAction,
  updatePasswordAction,
  verifyResetCodeAction,
  type ResetFlowActionState,
} from "../api/actions";

const initialState: ResetFlowActionState = { status: "idle" };

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
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
          />
          {requestState.status === "error" && requestState.message && (
            <p role="alert">{requestState.message}</p>
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
          <FormField
            label="Code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={codeError}
          />
          {verifyState.status === "error" && verifyState.message && (
            <p role="alert">{verifyState.message}</p>
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
        <FormField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={passwordError}
        />
        <FormField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={confirmPasswordError}
        />
        {updateState.status === "error" && updateState.message && (
          <p role="alert">{updateState.message}</p>
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
