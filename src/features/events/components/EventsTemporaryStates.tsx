/**
 * Loading, empty, and error states for the volunteer event screens.
 *
 * TEMPORARY: FOR-115 adds shared LoadingState / EmptyState / ErrorState
 * components for the volunteer shell. Swap each of these for the shared one
 * once it lands; every event screen gets its states from this file only.
 * Never pass a raw backend error message in here.
 */
import { Skeleton } from "@/components/ui/skeleton"

export function EventListLoading() {
  return (
    <div aria-busy="true" aria-label="Loading events" className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border p-3">
          <Skeleton className="hidden size-24 shrink-0 rounded-lg sm:block" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="ml-auto h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EventDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading event" className="grid gap-6 p-6 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export function EventsEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-header-sm">No events found</p>
      <p className="text-body-sm text-muted-foreground">
        {filtered ? "Try a different search or clear your filters." : "Check back soon for new events."}
      </p>
    </div>
  )
}

export function EventsErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-1 rounded-xl border px-6 py-12 text-center">
      <p className="text-header-sm">{title}</p>
      <p className="text-body-sm text-muted-foreground">{message}</p>
    </div>
  )
}
