"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { updateOrganizationSettingsAction } from "../api/actions"
import type { OrganizationSettings } from "../schemas/settingsSchema"
import { FieldError, errorMessage, fieldErrorsOf } from "./formHelpers"
import { TextListEditor } from "./TextListEditor"

export type OrganizationSettingsFormProps = {
  organization: OrganizationSettings
}

export function OrganizationSettingsForm({ organization }: OrganizationSettingsFormProps) {
  const router = useRouter()
  const [name, setName] = useState(organization.name)
  const [message, setMessage] = useState(organization.defaultRejectionMessage ?? "")
  const [eventCategories, setEventCategories] = useState(organization.eventCategories)
  const [skills, setSkills] = useState(organization.skills)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [status, setStatus] = useState<{ kind: "saved" } | { kind: "error"; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)
    startTransition(async () => {
      const result = await updateOrganizationSettingsAction({
        name,
        defaultRejectionMessage: message,
        eventCategories,
        skills,
      })
      if (result.ok) {
        // Show what was saved: trimmed, and a blank message cleared.
        setName(result.data.name)
        setMessage(result.data.defaultRejectionMessage ?? "")
        setEventCategories(result.data.eventCategories)
        setSkills(result.data.skills)
        setFieldErrors({})
        setStatus({ kind: "saved" })
        router.refresh()
      } else {
        setFieldErrors(fieldErrorsOf(result.error))
        setStatus({ kind: "error", message: errorMessage(result.error) })
      }
    })
  }

  const error = (field: string) => fieldErrors[field]?.[0]
  const describedBy = (field: string) => (error(field) ? `org-${field}-error` : undefined)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          className="max-w-md"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          aria-invalid={error("name") ? true : undefined}
          aria-describedby={describedBy("name")}
        />
        <FieldError id="org-name-error" message={error("name")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-defaultRejectionMessage">Default rejection message</Label>
        <p id="org-defaultRejectionMessage-help" className="text-sm text-muted-foreground">
          Applicants see this when they&apos;re rejected without a written message. Leave it blank to show none.
        </p>
        <Textarea
          id="org-defaultRejectionMessage"
          className="max-w-2xl"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={pending}
          aria-invalid={error("defaultRejectionMessage") ? true : undefined}
          aria-describedby={
            ["org-defaultRejectionMessage-help", describedBy("defaultRejectionMessage")].filter(Boolean).join(" ")
          }
        />
        <FieldError id="org-defaultRejectionMessage-error" message={error("defaultRejectionMessage")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-eventCategories">Event categories</Label>
        <p className="text-sm text-muted-foreground">Categories for grouping events.</p>
        <TextListEditor
          id="org-eventCategories"
          noun="category"
          plural="categories"
          values={eventCategories}
          onChange={setEventCategories}
          disabled={pending}
          invalid={Boolean(error("eventCategories"))}
          describedBy={describedBy("eventCategories")}
        />
        <FieldError id="org-eventCategories-error" message={error("eventCategories")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-skills">Skill options</Label>
        <p className="text-sm text-muted-foreground">Skills volunteers can choose from.</p>
        <TextListEditor
          id="org-skills"
          noun="skill"
          plural="skills"
          values={skills}
          onChange={setSkills}
          disabled={pending}
          invalid={Boolean(error("skills"))}
          describedBy={describedBy("skills")}
        />
        <FieldError id="org-skills-error" message={error("skills")} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {status?.kind === "saved" && <span className="text-muted-foreground">Saved.</span>}
          {status?.kind === "error" && <span className="text-destructive">{status.message}</span>}
        </p>
      </div>
    </form>
  )
}
