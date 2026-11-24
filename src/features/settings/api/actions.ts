"use server"

import type { OrganizationSettings } from "../schemas/settingsSchema"
import type { CustomQuestion, SettingsResult } from "./adminContext"
import { createCustomField, deleteCustomField, reorderCustomFields, updateCustomField } from "./customFields"
import { updateOrganizationSettings } from "./organizationSettings"

// Server Action wrappers so the settings forms can call these directly.
// Input comes straight from the client, so each function validates it.

export async function updateOrganizationSettingsAction(input: unknown): Promise<SettingsResult<OrganizationSettings>> {
  return updateOrganizationSettings(input)
}

export async function createCustomFieldAction(input: unknown): Promise<SettingsResult<CustomQuestion>> {
  return createCustomField(input)
}

export async function updateCustomFieldAction(id: string, input: unknown): Promise<SettingsResult<CustomQuestion>> {
  return updateCustomField(id, input)
}

export async function deleteCustomFieldAction(id: string): Promise<SettingsResult<{ id: string }>> {
  return deleteCustomField(id)
}

export async function reorderCustomFieldsAction(input: unknown): Promise<SettingsResult<{ ids: string[] }>> {
  return reorderCustomFields(input)
}
