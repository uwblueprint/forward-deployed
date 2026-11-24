import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type LoadingStateProps = {
  // Announced to screen readers; the skeleton itself is decorative.
  label?: string
  // Number of placeholder rows under the heading skeleton.
  rows?: number
  className?: string
}

/**
 * Skeleton placeholder for a page or section while it loads (same Skeleton
 * primitive as the DataTable loading rows). Used by route-level loading.tsx.
 *
 * <LoadingState />
 * <LoadingState label="Loading events" rows={5} />
 */
export function LoadingState({ label = "Loading", rows = 3, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="loading-state"
      className={cn("flex w-full flex-col gap-6", className)}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
