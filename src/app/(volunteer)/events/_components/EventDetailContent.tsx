import { notFound } from "next/navigation"

import { EventDetail, EventsErrorState, getEventDetailsAction } from "@/features/events"

const ERRORS = {
  "not-found": { title: "Event not found", message: "This event doesn't exist or is no longer available." },
  unauthenticated: { title: "Sign in to continue", message: "Sign in to view this event." },
  backend: { title: "Couldn't load this event", message: "Something went wrong. Refresh the page to try again." },
} as const

/**
 * Loads one event for the modal and the standalone page. Render inside <Suspense>.
 *
 * An unknown, foreign, or malformed id is notFound() on the standalone page.
 * Inside <Suspense> the response has already started streaming, so Next.js
 * renders the not-found UI with a noindex tag but keeps the 200 status (see
 * node_modules/next/dist/docs/.../not-found.md). The modal shows a short
 * message instead of replacing the list behind it.
 */
export async function EventDetailContent({
  params,
  variant,
}: {
  params: Promise<{ eventId: string }>
  variant: "page" | "modal"
}) {
  const { eventId } = await params
  const result = await getEventDetailsAction(eventId)
  if (!result.ok && result.error.type === "not-found" && variant === "page") notFound()
  if (!result.ok) {
    const { title, message } = ERRORS[result.error.type]
    return (
      <div className="p-6">
        <EventsErrorState title={title} message={message} />
      </div>
    )
  }

  // A Server Component renders once per request; reading the clock after the
  // request-bound query gives one "now" that the client then reuses.
  // eslint-disable-next-line react-hooks/purity -- see above
  const now = Date.now()
  return <EventDetail {...result.data} now={now} headingLevel={variant === "page" ? 1 : 2} />
}
