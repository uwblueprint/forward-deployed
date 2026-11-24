import { Suspense } from "react"

import {
  EventFilters,
  EventList,
  EventListLoading,
  EventsErrorState,
  deriveEventState,
  getMyVolunteerStatusAction,
  getOpportunitiesAction,
  hasEventFilters,
  parseEventFilters,
  toOpportunityFilters,
} from "@/features/events"
import type { Event } from "@/lib/adapters"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
    a.localeCompare(b)
  )
}

// Only published events that haven't ended. getOpportunities also returns
// past events the volunteer registered for; those belong to My Events.
function discoverable(events: Event[], now: number) {
  return events.filter((event) => event.status === "published" && deriveEventState(event, now).phase !== "ended")
}

async function EventsBrowser({ searchParams }: { searchParams: SearchParams }) {
  const values = parseEventFilters(await searchParams)
  const filtered = hasEventFilters(values)

  const [result, unfiltered, status] = await Promise.all([
    getOpportunitiesAction(toOpportunityFilters(values)),
    // Category and location choices come from every event, not just the matches.
    filtered ? getOpportunitiesAction() : null,
    getMyVolunteerStatusAction(),
  ])

  if (!result.ok) {
    return (
      <>
        <Hero>
          <EventFilters values={values} categories={[]} locations={[]} />
        </Hero>
        {result.error.type === "unauthenticated" ? (
          <EventsErrorState title="Sign in to continue" message="Sign in to browse events." />
        ) : (
          <EventsErrorState
            title="Couldn't load events"
            message="Something went wrong. Refresh the page to try again."
          />
        )}
      </>
    )
  }

  // Server Component: renders once per request, after the request-bound
  // queries above, so this is the request's time. Cards reuse it.
  // eslint-disable-next-line react-hooks/purity -- see above
  const now = Date.now()
  const events = discoverable(result.data, now)
  const options = discoverable(unfiltered?.ok ? unfiltered.data : result.data, now)
  // If the status lookup fails, don't claim the volunteer is ineligible -
  // the registration itself is still refused by RLS if they are.
  const volunteerStatus = status.ok ? status.data : "approved"

  return (
    <>
      <Hero>
        <EventFilters
          values={values}
          categories={distinct(options.map((event) => event.category))}
          locations={distinct(options.map((event) => event.location))}
        />
        <p className="text-caption-md text-muted-foreground">
          {events.length} {events.length === 1 ? "event" : "events"}
        </p>
      </Hero>
      <EventList events={events} volunteerStatus={volunteerStatus} filtered={filtered} now={now} />
    </>
  )
}

// Figma "Find Events" header band.
function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-linear-to-b from-selected to-background px-4 pt-10 pb-4 text-center">
      <h1 className="text-header-md">Find Events</h1>
      {children}
    </div>
  )
}

export default function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <Suspense
        fallback={
          <>
            <Hero />
            <EventListLoading />
          </>
        }
      >
        <EventsBrowser searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
