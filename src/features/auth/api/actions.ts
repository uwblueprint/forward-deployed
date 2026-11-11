"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requestPasswordReset, updatePassword, verifyResetCode } from "./auth";

export type ResetFlowActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function requestPasswordResetAction(
  _prevState: ResetFlowActionState,
  formData: FormData,
): Promise<ResetFlowActionState> {
  const result = await requestPasswordReset({
    email: String(formData.get("email") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  return {
    status: "success",
    message: "If an account exists for that email, we've sent a code.",
  };
}

export async function verifyResetCodeAction(
  _prevState: ResetFlowActionState,
  formData: FormData,
): Promise<ResetFlowActionState> {
  const result = await verifyResetCode({
    email: String(formData.get("email") ?? ""),
    code: String(formData.get("code") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  return { status: "success" };
}

export async function updatePasswordAction(
  _prevState: ResetFlowActionState,
  formData: FormData,
): Promise<ResetFlowActionState> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "Your reset session has expired. Start over.",
    };
  }

  const result = await updatePassword({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!result.ok) {
    return result.error.type === "validation"
      ? { status: "error", fieldErrors: result.error.fieldErrors }
      : { status: "error", message: result.error.message };
  }

  redirect("/dashboard");
}
