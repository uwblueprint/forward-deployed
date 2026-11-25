"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CustomField } from "@/lib/customFieldAnswers"
import type { Json } from "@/lib/supabase/database.types"

/** Raw input state, keyed by custom_fields.id. Numbers stay strings until submit. */
export type QuestionValues = Record<string, string | boolean | string[]>

function optionStrings(options: Json): string[] {
  return Array.isArray(options) ? options.filter((option): option is string => typeof option === "string") : []
}

/**
 * The registration answers payload registerForEvent expects: keyed by
 * custom_fields.id, blanks left out, numbers as numbers. A number that
 * doesn't parse stays a string so validation reports it.
 */
export function toAnswers(questions: CustomField[], values: QuestionValues): Record<string, unknown> {
  const answers: Record<string, unknown> = {}
  for (const question of questions) {
    const value = values[question.id]
    if (value === undefined || value === "") continue
    if (question.field_type === "number" && typeof value === "string") {
      const parsed = Number(value)
      answers[question.id] = Number.isFinite(parsed) ? parsed : value
    } else {
      answers[question.id] = value
    }
  }
  return answers
}

interface RegistrationQuestionsProps {
  questions: CustomField[]
  values: QuestionValues
  errors: Record<string, string[]>
  disabled?: boolean
  onChange: (id: string, value: string | boolean | string[]) => void
}

/** The organization's registration questions (custom fields), rendered by type. */
export function RegistrationQuestions({ questions, values, errors, disabled, onChange }: RegistrationQuestionsProps) {
  return (
    <div className="flex flex-col gap-5">
      {questions.map((question) => {
        const id = `question-${question.id}`
        const error = errors[question.id]?.[0]
        const errorId = error ? `${id}-error` : undefined
        const label = (
          <>
            {question.field_name}
            {question.required ? (
              <span aria-hidden className="text-destructive">
                *
              </span>
            ) : (
              <span className="font-normal text-muted-foreground">(optional)</span>
            )}
          </>
        )
        const common = {
          id,
          disabled,
          required: question.required,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": errorId,
        }
        const text = typeof values[question.id] === "string" ? (values[question.id] as string) : ""

        let control: React.ReactNode
        switch (question.field_type) {
          case "textarea":
            control = (
              <Textarea
                {...common}
                placeholder="Type your answer here"
                value={text}
                onChange={(e) => onChange(question.id, e.target.value)}
              />
            )
            break
          case "number":
          case "date":
          case "text":
            control = (
              <Input
                {...common}
                type={question.field_type}
                value={text}
                onChange={(e) => onChange(question.id, e.target.value)}
              />
            )
            break
          case "checkbox":
            return (
              <div key={question.id} className="flex flex-col gap-1.5">
                <Label className="font-normal">
                  <Checkbox
                    {...common}
                    checked={values[question.id] === true}
                    onCheckedChange={(checked) => onChange(question.id, checked)}
                  />
                  {label}
                </Label>
                <FieldError id={errorId} message={error} />
              </div>
            )
          case "select":
            control = (
              <Select value={text || null} onValueChange={(value) => onChange(question.id, value ? String(value) : "")}>
                <SelectTrigger {...common} className="w-full">
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent>
                  {optionStrings(question.options).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
            break
          case "multiselect": {
            const chosen = Array.isArray(values[question.id]) ? (values[question.id] as string[]) : []
            return (
              <fieldset key={question.id} className="flex flex-col gap-2" aria-describedby={errorId}>
                <legend className="mb-2 flex items-center gap-2 text-sm font-medium">{label}</legend>
                {optionStrings(question.options).map((option) => (
                  <Label key={option} className="font-normal">
                    <Checkbox
                      disabled={disabled}
                      checked={chosen.includes(option)}
                      onCheckedChange={(checked) =>
                        onChange(
                          question.id,
                          checked ? [...chosen, option] : chosen.filter((item) => item !== option)
                        )
                      }
                    />
                    {option}
                  </Label>
                ))}
                <FieldError id={errorId} message={error} />
              </fieldset>
            )
          }
          default:
            return null
        }

        return (
          <div key={question.id} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {control}
            <FieldError id={errorId} message={error} />
          </div>
        )
      })}
    </div>
  )
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-caption-md text-destructive">
      {message}
    </p>
  )
}
