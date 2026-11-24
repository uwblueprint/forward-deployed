"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TextListEditorProps = {
  id: string
  /** What one entry is called, e.g. "category", for labels and messages. */
  noun: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  describedBy?: string
  invalid?: boolean
}

/** A list of short text entries: type one and press Enter or Add, remove with ×. */
export function TextListEditor({
  id,
  noun,
  values,
  onChange,
  placeholder,
  disabled,
  describedBy,
  invalid,
}: TextListEditorProps) {
  const [draft, setDraft] = useState("")
  const [hint, setHint] = useState<string | null>(null)

  function add() {
    const value = draft.trim()
    if (!value) return
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setHint(`"${value}" is already in the list`)
      return
    }
    onChange([...values, value])
    setDraft("")
    setHint(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${noun} list`}>
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-2 text-sm"
            >
              <span>{value}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${value}`}
                disabled={disabled}
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No {noun}s yet.</p>
      )}
      <div className="flex max-w-md gap-2">
        <Input
          id={id}
          value={draft}
          placeholder={placeholder ?? `Add a ${noun}`}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            setHint(null)
          }}
          onKeyDown={(event) => {
            // Enter adds the entry instead of submitting the surrounding form.
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled || !draft.trim()}>
          <PlusIcon />
          Add
        </Button>
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
