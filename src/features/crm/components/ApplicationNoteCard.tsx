"use client"

import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

import { saveApplicationNoteAction } from "../api/actions"
import { reviewErrorMessage } from "./errorMessages"

export type ApplicationNoteCardProps = {
  applicationId: string
  note: string | null
}

/** The admin-only internal note. Render it only for admins; the database hides notes from everyone else. */
export function ApplicationNoteCard({ applicationId, note }: ApplicationNoteCardProps) {
  const router = useRouter()
  const fieldId = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  function save() {
    setError(null)
    startSaving(async () => {
      const result = await saveApplicationNoteAction(applicationId, draft)
      if (!result.ok) {
        setError(reviewErrorMessage(result.error))
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Internal note</CardTitle>
        <CardDescription>Only admins see this. The volunteer and managers never do.</CardDescription>
        {!editing && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(note ?? "")
                setEditing(true)
              }}
            >
              {note ? "Edit note" : "Add note"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <label htmlFor={fieldId} className="sr-only">
              Internal note
            </label>
            <Textarea id={fieldId} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save note"}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{note ?? <span className="text-muted-foreground">No note yet.</span>}</p>
        )}
      </CardContent>
    </Card>
  )
}
