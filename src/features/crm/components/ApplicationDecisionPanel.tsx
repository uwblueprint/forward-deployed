"use client"

import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Enums } from "@/lib/supabase/database.types"

import { approveOrRejectApplicationAction, editApplicantMessageAction } from "../api/actions"
import { reviewErrorMessage } from "./errorMessages"

type Status = Enums<"volunteer_status">
type Mode = "approved" | "rejected" | "message"

export type ApplicationDecisionPanelProps = {
  applicationId: string
  applicantName: string
  status: Status
  applicantMessage: string | null
  /** Admins can write an internal note with the decision. */
  canWriteNote: boolean
  hasNote: boolean
}

const MESSAGE_LIMIT = 2000
const NOTE_LIMIT = 5000
// Long text scrolls inside the box instead of pushing the buttons off screen.
const TEXTAREA_CLASS = "max-h-40 overflow-y-auto wrap-anywhere"

/**
 * Approve, reject, change a decision, or fix a rejection's message. Each
 * opens a confirmation dialog. A decision only applies if the application
 * still has the status shown here, so two reviewers can't overwrite each
 * other without seeing it.
 */
export function ApplicationDecisionPanel({
  applicationId,
  applicantName,
  status,
  applicantMessage,
  canWriteNote,
  hasNote,
}: ApplicationDecisionPanelProps) {
  const [mode, setMode] = useState<Mode | null>(null)

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <>
          <Button onClick={() => setMode("approved")}>Approve</Button>
          <Button variant="destructive" onClick={() => setMode("rejected")}>
            Reject
          </Button>
        </>
      )}
      {status === "approved" && (
        <Button variant="outline" onClick={() => setMode("rejected")}>
          Change to rejected
        </Button>
      )}
      {status === "rejected" && (
        <>
          <Button variant="outline" onClick={() => setMode("approved")}>
            Change to approved
          </Button>
          <Button variant="outline" onClick={() => setMode("message")}>
            Edit message
          </Button>
        </>
      )}

      {mode && (
        <DecisionDialog
          key={mode}
          mode={mode}
          applicationId={applicationId}
          applicantName={applicantName}
          status={status}
          applicantMessage={applicantMessage}
          canWriteNote={canWriteNote && mode !== "message"}
          hasNote={hasNote}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  )
}

const COPY: Record<Mode, { title: (name: string) => string; description: string; confirm: string }> = {
  approved: {
    title: (name) => `Approve ${name}?`,
    description: "They can register for events right away.",
    confirm: "Approve",
  },
  rejected: {
    title: (name) => `Reject ${name}?`,
    description: "They see the message below and can apply again.",
    confirm: "Reject",
  },
  message: {
    title: () => "Edit the rejection message",
    description: "The volunteer sees the new message right away. The decision stays the same.",
    confirm: "Save message",
  },
}

function DecisionDialog({
  mode,
  applicationId,
  applicantName,
  status,
  applicantMessage,
  canWriteNote,
  hasNote,
  onClose,
}: Omit<ApplicationDecisionPanelProps, "canWriteNote"> & { mode: Mode; canWriteNote: boolean; onClose: () => void }) {
  const router = useRouter()
  const messageId = useId()
  const noteId = useId()
  const [message, setMessage] = useState(mode === "message" ? (applicantMessage ?? "") : "")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  // The status the reviewer saw when they opened the dialog. The page can
  // refresh behind it, and a decision must never go out against a status
  // they haven't seen.
  const [seenStatus] = useState(status)
  // Set once someone else changed the application: this dialog can only be closed.
  const [conflict, setConflict] = useState(false)
  const copy = COPY[mode]
  const asksForMessage = mode !== "approved"

  function submit() {
    setError(null)
    startSaving(async () => {
      const result =
        mode === "message"
          ? await editApplicantMessageAction(applicationId, message.trim())
          : await approveOrRejectApplicationAction(applicationId, mode, message.trim() || undefined, {
              expectedStatus: seenStatus,
              note: canWriteNote && note.trim() ? note : undefined,
            })

      if (!result.ok) {
        setError(reviewErrorMessage(result.error))
        // Someone else got there first: load what they did behind the dialog.
        if (result.error.type === "already-decided" || result.error.type === "not-latest") {
          setConflict(true)
          startSaving(() => router.refresh())
        }
        return
      }
      onClose()
      startSaving(() => router.refresh())
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title(applicantName)}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          {asksForMessage && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={messageId}>Message to the volunteer</Label>
              <Textarea
                id={messageId}
                value={message}
                maxLength={MESSAGE_LIMIT}
                className={TEXTAREA_CLASS}
                onChange={(e) => setMessage(e.target.value)}
                aria-describedby={`${messageId}-hint`}
              />
              <p id={`${messageId}-hint`} className="text-xs text-muted-foreground">
                Optional. Leave blank to use your organization&apos;s default message.
              </p>
            </div>
          )}

          {canWriteNote && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={noteId}>Internal note</Label>
              <Textarea id={noteId} value={note} maxLength={NOTE_LIMIT} className={TEXTAREA_CLASS} onChange={(e) => setNote(e.target.value)} aria-describedby={`${noteId}-hint`} />
              <p id={`${noteId}-hint`} className="text-xs text-muted-foreground">
                Optional. Only admins see it{hasNote ? "; it replaces the current note" : ""}.
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={saving} />}>
              {conflict ? "Close" : "Cancel"}
            </DialogClose>
            <Button type="submit" variant={mode === "rejected" ? "destructive" : "default"} disabled={saving || conflict}>
              {saving ? "Saving…" : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
