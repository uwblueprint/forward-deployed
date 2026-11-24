"use client"

import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { updateUserNameAction } from "../api/actions"
import { userNameSchema, type UserName } from "../schemas/volunteerSchema"

export type UserNameFormProps = {
  userId: string
  initialValues: UserName
  onSaved: () => void
  onCancel: () => void
}

/** Changes someone's first and last name. Only admins see it for other people. */
export function UserNameForm({ userId, initialValues, onSaved, onCancel }: UserNameFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Partial<Record<string, string[]>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    const parsed = userNameSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)
    setSaving(true)
    try {
      const result = await updateUserNameAction(userId, parsed.data)
      if (result.ok) {
        onSaved()
        return
      }
      if (result.error.type === "validation") {
        setErrors(result.error.fieldErrors)
      } else if (result.error.type === "forbidden") {
        setFormError("Only admins can rename other people.")
      } else {
        setFormError("Couldn't save the name. Try again.")
      }
    } catch {
      setFormError("Couldn't save the name. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      aria-label="Rename"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="flex flex-wrap gap-3">
        {(["firstName", "lastName"] as const).map((name) => (
          <div key={name} className="flex flex-col gap-1.5">
            <Label htmlFor={name}>{name === "firstName" ? "First name" : "Last name"}</Label>
            <Input
              id={name}
              value={values[name]}
              onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
              aria-invalid={errors[name] ? true : undefined}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
            />
            {errors[name] && (
              <p id={`${name}-error`} role="alert" className="text-sm text-destructive">
                {errors[name][0]}
              </p>
            )}
          </div>
        ))}
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save name"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
