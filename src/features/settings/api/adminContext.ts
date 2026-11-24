import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, Tables } from "@/lib/supabase/database.types"
import { createServerSupabaseClient } from "@/lib/supabase/server"

import { CUSTOM_FIELD_TYPES, type CustomFieldType } from "../schemas/settingsSchema"

export type SettingsError =
  | { type: "validation"; fieldErrors: Record<string, string[]> }
  | { type: "unauthenticated" }
  | { type: "not-allowed" }
  | { type: "not-found" }
  | { type: "backend"; message: string }

export type SettingsResult<T> = { ok: true; data: T } | { ok: false; error: SettingsError }

/** A question as the settings screens show it. */
export interface CustomQuestion {
  id: string
  fieldName: string
  fieldType: CustomFieldType
  required: boolean
  options: string[]
  position: number
}

type AdminContext = { supabase: SupabaseClient<Database>; organizationId: string }

/**
 * The signed-in admin's organization. The database enforces the same rule
 * (RLS lets only admins change settings and questions); checking here first
 * turns a refusal into a clear not-allowed instead of zero rows changed.
 */
export async function getAdminContext(): Promise<{ ok: true; data: AdminContext } | { ok: false; error: SettingsError }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: { type: "unauthenticated" } }
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return { ok: false, error: { type: "backend", message: error.message } }
  }
  if (membership?.role !== "admin") {
    return { ok: false, error: { type: "not-allowed" } }
  }

  return { ok: true, data: { supabase, organizationId: membership.organization_id } }
}

// Check constraints the settings tables have, by the field they're about.
const CHECK_CONSTRAINT_FIELDS: Array<[constraint: string, field: string, message: string]> = [
  ["custom_fields_options_check", "options", "Select questions need at least one option; other types have none"],
  ["custom_fields_field_name_check", "fieldName", "Enter the question"],
  ["custom_fields_field_type_check", "fieldType", "Pick a question type"],
  ["organizations_settings_lists", "form", "Categories and skills must be lists of text"],
]

/** 42501 is a permission refusal and 23514 a failed check; anything else is unexpected. */
export function fromDatabaseError(error: PostgrestError): SettingsError {
  if (error.code === "42501") {
    return { type: "not-allowed" }
  }
  if (error.code === "23514") {
    const match = CHECK_CONSTRAINT_FIELDS.find(([constraint]) => error.message.includes(constraint))
    return { type: "validation", fieldErrors: match ? { [match[1]]: [match[2]] } : { form: [error.message] } }
  }
  return { type: "backend", message: error.message }
}

/** A JSON list of strings, ignoring anything else. */
export function textList(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export function toCustomQuestion(field: Tables<"custom_fields">): CustomQuestion {
  return {
    id: field.id,
    fieldName: field.field_name,
    // The database only allows the known types.
    fieldType: (CUSTOM_FIELD_TYPES as readonly string[]).includes(field.field_type)
      ? (field.field_type as CustomFieldType)
      : "text",
    required: field.required,
    options: textList(field.options),
    position: field.position,
  }
}
