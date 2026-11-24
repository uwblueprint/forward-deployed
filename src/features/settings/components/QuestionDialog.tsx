"use client"

import { useRouter } from "next/navigation"
import { useId, useState, useTransition, type FormEvent, type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { createCustomFieldAction, updateCustomFieldAction } from "../api/actions"
import type { CustomQuestion } from "../api/adminContext"
import {
  CUSTOM_FIELD_TYPES,
  TYPES_WITH_OPTIONS,
  type CustomFieldEntityType,
  type CustomFieldType,
} from "../schemas/settingsSchema"
import { FieldError, errorMessage, fieldErrorsOf } from "./formHelpers"
import { TextListEditor } from "./TextListEditor"

export const QUESTION_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Short answer",
  textarea: "Paragraph",
  number: "Number",
  date: "Date",
  select: "Dropdown (pick one)",
  multiselect: "Checklist (pick any)",
  checkbox: "Yes/no checkbox",
}

type QuestionDialogProps = {
  entityType: CustomFieldEntityType
  /** The question to edit; leave out to add a new one. */
  question?: CustomQuestion
  trigger: ReactElement
}

/** Adds or edits one custom question. */
export function QuestionDialog({ entityType, question, trigger }: QuestionDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so each opening starts from the saved question. */}
        {open && <QuestionForm entityType={entityType} question={question} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function QuestionForm({
  entityType,
  question,
  onDone,
}: {
  entityType: CustomFieldEntityType
  question?: CustomQuestion
  onDone: () => void
}) {
  const router = useRouter()
  const idPrefix = useId()
  const [fieldName, setFieldName] = useState(question?.fieldName ?? "")
  const [fieldType, setFieldType] = useState<CustomFieldType>(question?.fieldType ?? "text")
  const [required, setRequired] = useState(question?.required ?? false)
  const [options, setOptions] = useState(question?.options ?? [])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const hasOptions = TYPES_WITH_OPTIONS.includes(fieldType)
  const fieldId = (field: string) => `${idPrefix}-${field}`
  const error = (field: string) => fieldErrors[field]?.[0]
  const describedBy = (field: string) => (error(field) ? fieldId(`${field}-error`) : undefined)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    startTransition(async () => {
      const input = { fieldName, fieldType, required, options: hasOptions ? options : [] }
      const result = question
        ? await updateCustomFieldAction(question.id, input)
        : await createCustomFieldAction({ ...input, entityType })
      if (result.ok) {
        onDone()
        router.refresh()
      } else {
        setFieldErrors(fieldErrorsOf(result.error))
        setFormError(result.error.type === "validation" && !result.error.fieldErrors.form ? null : errorMessage(result.error))
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{question ? "Edit question" : "Add a question"}</DialogTitle>
        <DialogDescription>
          {entityType === "application"
            ? "Asked when someone applies to volunteer."
            : "Asked when a volunteer signs up for an event."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("fieldName")}>Question</Label>
        <Input
          id={fieldId("fieldName")}
          value={fieldName}
          onChange={(event) => setFieldName(event.target.value)}
          disabled={pending}
          aria-invalid={error("fieldName") ? true : undefined}
          aria-describedby={describedBy("fieldName")}
        />
        <FieldError id={fieldId("fieldName-error")} message={error("fieldName")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("fieldType")}>Answer type</Label>
        <Select
          value={fieldType}
          items={QUESTION_TYPE_LABELS}
          onValueChange={(value) => setFieldType(value as CustomFieldType)}
          disabled={pending}
        >
          <SelectTrigger
            id={fieldId("fieldType")}
            className="w-full"
            aria-invalid={error("fieldType") ? true : undefined}
            aria-describedby={describedBy("fieldType")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOM_FIELD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id={fieldId("fieldType-error")} message={error("fieldType")} />
      </div>

      {hasOptions && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId("options")}>Options</Label>
          <TextListEditor
            id={fieldId("options")}
            noun="option"
            values={options}
            onChange={setOptions}
            disabled={pending}
            invalid={Boolean(error("options"))}
            describedBy={describedBy("options")}
          />
          <FieldError id={fieldId("options-error")} message={error("options")} />
        </div>
      )}

      <Label className="font-normal">
        <Checkbox checked={required} onCheckedChange={setRequired} disabled={pending} />
        Required
      </Label>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : question ? "Save question" : "Add question"}
        </Button>
      </DialogFooter>
    </form>
  )
}
