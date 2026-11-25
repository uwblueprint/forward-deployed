import type { SettingsError } from "../api/adminContext"

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}

/** A sentence for errors that aren't about one field. */
export function errorMessage(error: SettingsError): string {
  switch (error.type) {
    case "validation":
      return error.fieldErrors.form?.[0] ?? error.fieldErrors.ids?.[0] ?? "Check the highlighted fields."
    case "unauthenticated":
      return "Your session ended. Sign in again to save."
    case "not-allowed":
      return "Only admins can change these settings."
    case "not-found":
      return "That was removed or changed by someone else. Reload the page."
    case "backend":
      return "Something went wrong saving. Try again."
  }
}

export function fieldErrorsOf(error: SettingsError): Record<string, string[]> {
  return error.type === "validation" ? error.fieldErrors : {}
}
