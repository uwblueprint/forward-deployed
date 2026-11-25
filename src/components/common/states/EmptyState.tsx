import { InboxIcon } from "lucide-react"

import { StateMessage, type StateMessageProps } from "./StateMessage"

export type EmptyStateProps = Omit<StateMessageProps, "icon"> & {
  // Defaults to an inbox icon. Pass `null` for no icon.
  icon?: StateMessageProps["icon"] | null
}

/**
 * Shown when a page or list loaded fine but has nothing to show.
 *
 * <EmptyState
 *   title="No upcoming events"
 *   description="Events you register for will show up here."
 *   action={<Button nativeButton={false} render={<Link href="/events" />}>Find events</Button>}
 * />
 */
export function EmptyState({ icon = InboxIcon, ...props }: EmptyStateProps) {
  return <StateMessage data-slot="empty-state" icon={icon ?? undefined} {...props} />
}
