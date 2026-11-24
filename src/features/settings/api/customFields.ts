import { z } from "zod"

import { customFieldCreateSchema, customFieldOrderSchema, customFieldUpdateSchema } from "../schemas/settingsSchema"
import { fromDatabaseError, getAdminContext, toCustomQuestion, type CustomQuestion, type SettingsResult } from "./adminContext"

function validationError(error: z.ZodError): { ok: false; error: { type: "validation"; fieldErrors: Record<string, string[]> } } {
  return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(error).fieldErrors } }
}

// guid, not uuid: Postgres accepts ids that aren't RFC 4122 variants.
const isId = (id: unknown): id is string => z.guid().safeParse(id).success

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action; do not add "use server" to this file.
 *
 * Admin-only, like the custom_fields RLS. Old answers keep the questions as
 * they were asked (the `questions` snapshot on applications and
 * registrations), so editing or removing a question never changes them.
 */

/** Adds a question to the end of its list. */
export async function createCustomField(input: unknown): Promise<SettingsResult<CustomQuestion>> {
  const parsed = customFieldCreateSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)

  const context = await getAdminContext()
  if (!context.ok) return context
  const { supabase, organizationId } = context.data

  const { data: last, error: lastError } = await supabase
    .from("custom_fields")
    .select("position")
    .eq("organization_id", organizationId)
    .eq("entity_type", parsed.data.entityType)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) return { ok: false, error: fromDatabaseError(lastError) }

  const { data, error } = await supabase
    .from("custom_fields")
    .insert({
      organization_id: organizationId,
      entity_type: parsed.data.entityType,
      field_name: parsed.data.fieldName,
      field_type: parsed.data.fieldType,
      required: parsed.data.required,
      options: parsed.data.options,
      position: (last?.position ?? -1) + 1,
    })
    .select("*")
    .single()

  if (error) return { ok: false, error: fromDatabaseError(error) }

  return { ok: true, data: toCustomQuestion(data) }
}

/** Changes a question's wording, type, whether it's required, and its options. */
export async function updateCustomField(id: string, input: unknown): Promise<SettingsResult<CustomQuestion>> {
  const parsed = customFieldUpdateSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  if (!isId(id)) return { ok: false, error: { type: "not-found" } }

  const context = await getAdminContext()
  if (!context.ok) return context
  const { supabase, organizationId } = context.data

  const { data, error } = await supabase
    .from("custom_fields")
    .update({
      field_name: parsed.data.fieldName,
      field_type: parsed.data.fieldType,
      required: parsed.data.required,
      options: parsed.data.options,
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle()

  if (error) return { ok: false, error: fromDatabaseError(error) }
  if (!data) return { ok: false, error: { type: "not-found" } }

  return { ok: true, data: toCustomQuestion(data) }
}

export async function deleteCustomField(id: string): Promise<SettingsResult<{ id: string }>> {
  if (!isId(id)) return { ok: false, error: { type: "not-found" } }

  const context = await getAdminContext()
  if (!context.ok) return context
  const { supabase, organizationId } = context.data

  const { data, error } = await supabase
    .from("custom_fields")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: fromDatabaseError(error) }
  if (!data) return { ok: false, error: { type: "not-found" } }

  return { ok: true, data }
}

/**
 * Puts one kind of question (application or registration) in the given
 * order. `ids` must be exactly that kind's questions; if someone added or
 * removed one since the page loaded, nothing changes and the caller should
 * reload.
 */
export async function reorderCustomFields(input: unknown): Promise<SettingsResult<{ ids: string[] }>> {
  const parsed = customFieldOrderSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)

  const context = await getAdminContext()
  if (!context.ok) return context
  const { supabase } = context.data
  const { entityType, ids } = parsed.data

  // One database call that reorders all of them or none (see
  // supabase/migrations/20261124030000_reorder_custom_fields.sql).
  const { error } = await supabase.rpc("reorder_custom_fields", { target_entity_type: entityType, ordered_ids: ids })

  if (error?.code === "22023") {
    return {
      ok: false,
      error: { type: "validation", fieldErrors: { ids: ["The questions changed since this page loaded. Reload and try again."] } },
    }
  }
  if (error) return { ok: false, error: fromDatabaseError(error) }

  return { ok: true, data: { ids } }
}
