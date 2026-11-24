import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { StateMessage, type StateMessageProps } from "./StateMessage"

export type ErrorStateProps = Partial<Pick<StateMessageProps, "title">> &
  Omit<StateMessageProps, "title" | "icon"> & {
    // Renders a "Try again" button. Needs a client component caller (e.g. error.tsx's `retry`).
    onRetry?: () => void
    retryLabel?: string
  }

/**
 * Shown when something failed. Takes copy, never the thrown error: messages can
 * leak internals, so log the error and show friendly text instead.
 *
 * <ErrorState onRetry={retry} />
 * <ErrorState title="Couldn't load your events" action={<Button ...>Go back</Button>} />
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again.",
  onRetry,
  retryLabel = "Try again",
  action,
  ...props
}: ErrorStateProps) {
  return (
    <StateMessage
      data-slot="error-state"
      role="alert"
      icon={TriangleAlertIcon}
      title={title}
      description={description}
      action={
        onRetry || action ? (
          <>
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RotateCwIcon />
                {retryLabel}
              </Button>
            )}
            {action}
          </>
        ) : undefined
      }
      {...props}
    />
  )
}
