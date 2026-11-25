"use client"

import { useRef, useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { updateVolunteerProfileAction } from "../api/actions"
import { SHIFTS, WEEKDAYS, volunteerProfileUpdateSchema, type VolunteerProfileUpdate } from "../schemas/volunteerSchema"

type Shift = (typeof SHIFTS)[number]
type Weekday = (typeof WEEKDAYS)[number]

/** The form's in-progress values: a shift can still be unpicked. */
export type VolunteerProfileFormValues = Omit<VolunteerProfileUpdate, "shiftPreference"> & {
  shiftPreference: Shift | ""
}

export type VolunteerProfileFormProps = {
  volunteerId: string
  initialValues: VolunteerProfileFormValues
  /** The organization's skill list. Staff can still type others. */
  skillOptions: string[]
  onSaved: () => void
  onCancel: () => void
}

type FieldErrors = Partial<Record<string, string[]>>

function FieldError({ name, errors }: { name: string; errors: FieldErrors }) {
  const message = errors[name]?.[0]
  if (!message) return null
  return (
    <p id={`${name}-error`} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

/** Staff edit a volunteer's phone, location, availability, skills, and emergency contact. */
export function VolunteerProfileForm({
  volunteerId,
  initialValues,
  skillOptions,
  onSaved,
  onCancel,
}: VolunteerProfileFormProps) {
  const [values, setValues] = useState(initialValues)
  const [newSkill, setNewSkill] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The organization's list first, then anything this volunteer has that isn't on it.
  const allSkills = [...new Set([...skillOptions, ...values.skills])]

  function update(patch: Partial<VolunteerProfileFormValues>) {
    setValues((current) => ({ ...current, ...patch }))
  }

  function toggle<T extends string>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
  }

  function addSkill() {
    const skill = newSkill.trim()
    if (!skill) return
    if (!values.skills.includes(skill)) update({ skills: [...values.skills, skill] })
    setNewSkill("")
  }

  function invalid(name: string) {
    return errors[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {}
  }

  // A ref, not the saving state: two quick submits both run before a re-render.
  const inFlight = useRef(false)

  // Ties a group's error to the group, so it's read again on return to it.
  function fieldsetError(name: string) {
    return errors[name] ? { "aria-describedby": `${name}-error` } : {}
  }

  async function save() {
    if (inFlight.current) return
    const parsed = volunteerProfileUpdateSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }

    setErrors({})
    setFormError(null)
    setSaving(true)
    inFlight.current = true
    try {
      const result = await updateVolunteerProfileAction(volunteerId, parsed.data)
      if (result.ok) {
        onSaved()
        return
      }
      if (result.error.type === "validation") {
        setErrors(result.error.fieldErrors)
      } else if (result.error.type === "not-found") {
        setFormError("This volunteer isn't in your organization anymore.")
      } else if (result.error.type === "unauthenticated") {
        setFormError("Your session has expired. Sign in again to save.")
      } else {
        setFormError("Couldn't save the profile. Try again.")
      }
    } catch {
      setFormError("Couldn't save the profile. Try again.")
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form
      aria-label="Edit profile"
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(event) => update({ phone: event.target.value })}
            {...invalid("phone")}
          />
          <FieldError name="phone" errors={errors} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={values.location}
            onChange={(event) => update({ location: event.target.value })}
            {...invalid("location")}
          />
          <FieldError name="location" errors={errors} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" {...fieldsetError("weekdays")}>
        <legend className="mb-2 text-sm font-medium">Available days</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((day: Weekday) => (
            <label key={day} className="flex items-center gap-1.5 text-sm capitalize">
              <input
                type="checkbox"
                checked={values.weekdays.includes(day)}
                onChange={() => update({ weekdays: toggle(values.weekdays, day) })}
              />
              {day}
            </label>
          ))}
        </div>
        <FieldError name="weekdays" errors={errors} />
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shiftPreference">Shift preference</Label>
        <Select
          value={values.shiftPreference}
          onValueChange={(value) => update({ shiftPreference: (value ?? "") as Shift | "" })}
        >
          <SelectTrigger id="shiftPreference" className="w-full capitalize sm:w-48" {...invalid("shiftPreference")}>
            <SelectValue placeholder="Pick a shift" />
          </SelectTrigger>
          <SelectContent>
            {SHIFTS.map((shift) => (
              <SelectItem key={shift} value={shift} className="capitalize">
                {shift}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError name="shiftPreference" errors={errors} />
      </div>

      <fieldset className="flex flex-col gap-2" {...fieldsetError("skills")}>
        <legend className="mb-2 text-sm font-medium">Skills</legend>
        <div className="flex flex-wrap gap-3">
          {allSkills.map((skill) => (
            <label key={skill} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={values.skills.includes(skill)}
                onChange={() => update({ skills: toggle(values.skills, skill) })}
              />
              {skill}
            </label>
          ))}
        </div>
        <div className="flex max-w-sm gap-2">
          <Input
            aria-label="Add a skill"
            placeholder="Add a skill"
            value={newSkill}
            onChange={(event) => setNewSkill(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addSkill()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addSkill}>
            Add
          </Button>
        </div>
        <FieldError name="skills" errors={errors} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Emergency contact</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emergencyContactName">Contact name</Label>
          <Input
            id="emergencyContactName"
            value={values.emergencyContactName}
            onChange={(event) => update({ emergencyContactName: event.target.value })}
            {...invalid("emergencyContactName")}
          />
          <FieldError name="emergencyContactName" errors={errors} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emergencyContactPhone">Contact phone</Label>
          <Input
            id="emergencyContactPhone"
            type="tel"
            value={values.emergencyContactPhone}
            onChange={(event) => update({ emergencyContactPhone: event.target.value })}
            {...invalid("emergencyContactPhone")}
          />
          <FieldError name="emergencyContactPhone" errors={errors} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emergencyContactRelationship">Relationship</Label>
          <Input
            id="emergencyContactRelationship"
            value={values.emergencyContactRelationship}
            onChange={(event) => update({ emergencyContactRelationship: event.target.value })}
            {...invalid("emergencyContactRelationship")}
          />
          <FieldError name="emergencyContactRelationship" errors={errors} />
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
