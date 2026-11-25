import { Suspense } from "react"

import { EventDetailLoading, EventModal } from "@/features/events"

import { EventDetailContent } from "../../_components/EventDetailContent"

export default function EventModalPage({ params }: { params: Promise<{ eventId: string }> }) {
  return (
    <EventModal>
      <Suspense fallback={<EventDetailLoading />}>
        <EventDetailContent params={params} variant="modal" />
      </Suspense>
    </EventModal>
  )
}
