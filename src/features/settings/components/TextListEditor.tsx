"use client"

import { useRef, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TextListEditorProps = {
  id: string
  /** What one entry is called, e.g. "category", for labels and messages. */
  noun: string
  /** Its plural, e.g. "categories". */
  plural: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  describedBy?: string
  invalid?: boolean
}

/** A list of short text entries: type one and press Enter or Add (or just leave the box), remove with ×. */
export function TextListEditor({
  id,
  noun,
  plural,
  values,
  onChange,
  placeholder,
  disabled,
  describedBy,
  invalid,
}: TextListEditorProps) {
  const [draft, setDraft] = useState("")
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
                onClick={() => {
                  onChange(values.filter((item) => item !== value))
                  // The button is about to unmount; keep focus in the editor.
                  inputRef.current?.focus()
                }}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No {plural} yet.</p>
      )}
      <div className="flex max-w-md gap-2">
        <Input
          id={id}
          ref={inputRef}
          value={draft}
          placeholder={placeholder ?? `Add ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            setHint(null)
          }}
          // Leaving the box adds what was typed, so Save never drops an entry that wasn't "added".
          onBlur={add}
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
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {hint}
      </p>
    </div>
  )
}
