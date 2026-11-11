import type { Json, Tables } from "@/lib/supabase/database.types"

export type CustomField = Tables<"custom_fields">

export type CustomFieldAnswersResult =
  | { ok: true; data: Record<string, Json> }
  | { ok: false; fieldErrors: Record<string, string[]> }

function optionStrings(options: Json): string[] {
  return Array.isArray(options) ? options.filter((option): option is string => typeof option === "string") : []
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)
}

/** True when `value` is a valid answer for `field`, ignoring whether it was required. */
function matchesFieldType(field: CustomField, value: unknown): boolean {
  switch (field.field_type) {
    case "text":
    case "textarea":
      return typeof value === "string"
    case "number":
      return typeof value === "number" && Number.isFinite(value)
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
    case "checkbox":
      return typeof value === "boolean"
    case "select":
      return typeof value === "string" && optionStrings(field.options).includes(value)
    case "multiselect": {
      const allowed = optionStrings(field.options)
      return Array.isArray(value) && value.every((item) => typeof item === "string" && allowed.includes(item))
    }
    default:
      return false
  }
}

/**
 * Validates a submitted `responses`/`custom_responses` payload against an
 * organization's `custom_fields` definitions for one entity type
 * (`application` or `registration` - see supabase/migrations/20261027220355_create_tables.sql).
 * Answers are keyed by `custom_fields.id`, per that table's `responses`
 * column comment.
 *
 * Only configured fields are read from `answers`; unrecognized keys are
 * dropped rather than stored, since they don't correspond to a question the
 * organization actually asked.
 */
export function validateCustomFieldAnswers(fields: CustomField[], answers: unknown): CustomFieldAnswersResult {
  const source: Record<string, unknown> =
    typeof answers === "object" && answers !== null && !Array.isArray(answers)
      ? (answers as Record<string, unknown>)
      : {}

  const fieldErrors: Record<string, string[]> = {}
  const data: Record<string, Json> = {}

  for (const field of fields) {
    const value = source[field.id]

    if (isEmpty(value)) {
      if (field.required) {
        fieldErrors[field.id] = [`${field.field_name} is required`]
      }
      continue
    }

    if (!matchesFieldType(field, value)) {
      fieldErrors[field.id] = [`${field.field_name} has an invalid value`]
      continue
    }

    data[field.id] = value as Json
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  return { ok: true, data }
}
