import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { EventDetailLoading } from "@/features/events"

import { EventDetailContent } from "../_components/EventDetailContent"

/** The event page on a direct visit or refresh; from the list it opens as a modal instead. */
export default function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
      <Link
        href="/events"
        className="flex w-fit items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        All events
      </Link>
      <div className="overflow-hidden rounded-xl border bg-background">
        <Suspense fallback={<EventDetailLoading />}>
          <EventDetailContent params={params} variant="page" />
        </Suspense>
      </div>
    </div>
  )
}
