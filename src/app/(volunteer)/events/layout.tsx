/**
 * `modal` is the @modal slot: /events/[eventId] opened from the list renders
 * there, over the list, as the Figma "Event-modal" (an intercepted route). A
 * direct visit or refresh renders the standalone [eventId] page instead.
 */
export default function EventsLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
