import { z } from "zod"

import type { Json } from "@/lib/supabase/database.types"

import { organizationSettingsSchema, type OrganizationSettings } from "../schemas/settingsSchema"
import {
  fromDatabaseError,
  getAdminContext,
  textList,
  toCustomQuestion,
  type CustomQuestion,
  type SettingsResult,
} from "./adminContext"

export interface SettingsPageData {
  organization: OrganizationSettings
  applicationQuestions: CustomQuestion[]
  registrationQuestions: CustomQuestion[]
}

function settingsObject(settings: Json): Record<string, Json | undefined> {
  return typeof settings === "object" && settings !== null && !Array.isArray(settings) ? settings : {}
}

/**
 * Plain server-side functions - not Server Actions. Call them from inside a
 * Server Action or a server component; do not add "use server" to this file.
 *
 * Admin-only. Everything the settings page shows: the organization's name,
 * default rejection message, event categories, and skill options, and its
 * custom questions for applications and event signups, in order.
 */
export async function getSettings(): Promise<SettingsResult<SettingsPageData>> {
  const context = await getAdminContext()
  if (!context.ok) return context
  const { supabase, organizationId } = context.data

  const [organizationResult, fieldsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, default_rejection_message, settings")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("custom_fields")
      .select("*")
      .eq("organization_id", organizationId)
      .order("position")
      // Same tie-break as the questions snapshot the database saves with each answer.
      .order("id"),
  ])

  if (organizationResult.error) return { ok: false, error: fromDatabaseError(organizationResult.error) }
  if (fieldsResult.error) return { ok: false, error: fromDatabaseError(fieldsResult.error) }
  if (!organizationResult.data) return { ok: false, error: { type: "not-found" } }

  const organization = organizationResult.data
  const settings = settingsObject(organization.settings)
  const fields = fieldsResult.data ?? []

  return {
    ok: true,
    data: {
      organization: {
        name: organization.name,
        defaultRejectionMessage: organization.default_rejection_message,
        eventCategories: textList(settings.event_categories),
        skills: textList(settings.skills),
      },
      applicationQuestions: fields.filter((field) => field.entity_type === "application").map(toCustomQuestion),
      registrationQuestions: fields.filter((field) => field.entity_type === "registration").map(toCustomQuestion),
    },
  }
}

/**
 * Admin-only. Saves the organization's name, default rejection message
 * (blank clears it), event categories, and skill options. Other keys in
 * `settings` are kept as they are.
 */
export async function updateOrganizationSettings(input: unknown): Promise<SettingsResult<OrganizationSettings>> {
  const parsed = organizationSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { type: "validation", fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const context = await getAdminContext()
  if (!context.ok) return context
  const { supabase, organizationId } = context.data

  const { data: current, error: readError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle()

  if (readError) return { ok: false, error: fromDatabaseError(readError) }
  if (!current) return { ok: false, error: { type: "not-found" } }

  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      default_rejection_message: parsed.data.defaultRejectionMessage,
      settings: {
        ...settingsObject(current.settings),
        event_categories: parsed.data.eventCategories,
        skills: parsed.data.skills,
      },
    })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: fromDatabaseError(error) }
  if (!data) return { ok: false, error: { type: "not-found" } }

  return { ok: true, data: parsed.data }
}
