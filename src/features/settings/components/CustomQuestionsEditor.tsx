"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { deleteCustomFieldAction, reorderCustomFieldsAction } from "../api/actions"
import type { CustomQuestion } from "../api/adminContext"
import type { CustomFieldEntityType } from "../schemas/settingsSchema"
import { errorMessage } from "./formHelpers"
import { QUESTION_TYPE_LABELS, QuestionDialog } from "./QuestionDialog"

export type CustomQuestionsEditorProps = {
  entityType: CustomFieldEntityType
  questions: CustomQuestion[]
}

/** One kind of custom question (application or event signup): add, edit, reorder, remove. */
export function CustomQuestionsEditor({ entityType, questions }: CustomQuestionsEditorProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function move(index: number, offset: -1 | 1) {
    const ids = questions.map((question) => question.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + offset, 0, moved)
    setError(null)
    startTransition(async () => {
      const result = await reorderCustomFieldsAction({ entityType, ids })
      if (!result.ok) setError(errorMessage(result.error))
      // Inside the transition, so the buttons stay disabled until the new
      // order arrives and a second quick move can't be built from the old one.
      startTransition(() => router.refresh())
    })
  }

  const noun = entityType === "application" ? "application" : "event signup"

  return (
    <div className="flex flex-col gap-3">
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {noun} questions yet.</p>
      ) : (
        <ol className="flex flex-col divide-y rounded-lg border" aria-busy={pending || undefined}>
          {questions.map((question, index) => (
            <li key={question.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium break-words">
                  <span className="mr-1 text-muted-foreground tabular-nums">{index + 1}.</span>{" "}
                  {question.fieldName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  <span>{QUESTION_TYPE_LABELS[question.fieldType]}</span>
                  {question.required ? <Badge variant="secondary">Required</Badge> : <Badge variant="outline">Optional</Badge>}
                </div>
                {question.options.length > 0 && (
                  <p className="text-sm text-muted-foreground break-words">Options: {question.options.join(", ")}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move "${question.fieldName}" up`}
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move "${question.fieldName}" down`}
                  disabled={pending || index === questions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <QuestionDialog
                  entityType={entityType}
                  question={question}
                  trigger={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit "${question.fieldName}"`} disabled={pending}>
                      <PencilIcon />
                    </Button>
                  }
                />
                <DeleteQuestionDialog question={question} disabled={pending} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <QuestionDialog
          entityType={entityType}
          trigger={
            <Button type="button" variant="outline" disabled={pending}>
              <PlusIcon />
              Add question
            </Button>
          }
        />
      </div>
    </div>
  )
}

function DeleteQuestionDialog({ question, disabled }: { question: CustomQuestion; disabled: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteCustomFieldAction(question.id)
      if (result.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(errorMessage(result.error))
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove "${question.fieldName}"`} disabled={disabled}>
            <Trash2Icon />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this question?</DialogTitle>
          <DialogDescription>
            &ldquo;{question.fieldName}&rdquo; won&apos;t be asked anymore. Answers people already gave are kept.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
            {pending ? "Removing…" : "Remove question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
