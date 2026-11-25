"use client"

import { useRouter } from "next/navigation"
import { MailIcon } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

/**
 * Figma "Event-modal" frame: the /events/[id] page shown over the event list
 * (an intercepted route). Closing goes back to the list.
 */
export function EventModal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) router.back()
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
          <MailIcon aria-hidden className="size-4 text-muted-foreground" />
          <DialogTitle className="text-body-sm font-normal text-muted-foreground">Register for Event</DialogTitle>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}
