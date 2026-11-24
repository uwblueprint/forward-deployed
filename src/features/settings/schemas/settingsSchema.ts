import { z } from "zod"

// These mirror the database's checks (supabase/migrations/20261111034139_org_config.sql
// and 20261027220355_create_tables.sql), so admins see the problem before saving.

export const CUSTOM_FIELD_ENTITY_TYPES = ["application", "registration"] as const
export const CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "date", "select", "multiselect", "checkbox"] as const

export type CustomFieldEntityType = (typeof CUSTOM_FIELD_ENTITY_TYPES)[number]
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

/** Only these question types have options. */
export const TYPES_WITH_OPTIONS: readonly CustomFieldType[] = ["select", "multiselect"]

/**
 * A list of non-blank text, like settings.event_categories or a question's
 * options. Entries are trimmed; the same entry twice is refused.
 */
const textList = (noun: string) =>
  z
    .array(z.string().trim().min(1, `${noun} can't be blank`).max(200, `${noun} must be 200 characters or fewer`))
    .max(100, `Keep it to 100 ${noun.toLowerCase()}s or fewer`)
    .refine((items) => new Set(items.map((item) => item.toLowerCase())).size === items.length, {
      message: `Each ${noun.toLowerCase()} can only appear once`,
    })

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, "Enter the organization's name").max(200, "Keep the name to 200 characters or fewer"),
  // Blank means no default: a rejection without a message then shows none.
  defaultRejectionMessage: z
    .string()
    .trim()
    .max(2000, "Keep the message to 2000 characters or fewer")
    .nullish()
    .transform((value) => value || null),
  eventCategories: textList("Category"),
  skills: textList("Skill"),
})

export type OrganizationSettingsInput = z.input<typeof organizationSettingsSchema>
export type OrganizationSettings = z.output<typeof organizationSettingsSchema>

const questionFieldsSchema = z.object({
  fieldName: z.string().trim().min(1, "Enter the question").max(500, "Keep the question to 500 characters or fewer"),
  fieldType: z.enum(CUSTOM_FIELD_TYPES, "Pick a question type"),
  required: z.boolean(),
  options: textList("Option").default([]),
})

// Select and multiselect need options; other types have none. Options left
// over from switching a question's type are dropped rather than refused.
function withOptionRules<T extends z.infer<typeof questionFieldsSchema>>(question: T, ctx: z.RefinementCtx) {
  if (TYPES_WITH_OPTIONS.includes(question.fieldType) && question.options.length === 0) {
    ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least one option" })
  }
}

function dropUnusedOptions<T extends z.infer<typeof questionFieldsSchema>>(question: T): T {
  return TYPES_WITH_OPTIONS.includes(question.fieldType) ? question : { ...question, options: [] }
}

/** A new question. It goes to the end of its list. */
export const customFieldCreateSchema = questionFieldsSchema
  .extend({ entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES, "Pick where the question is asked") })
  .superRefine(withOptionRules)
  .transform(dropUnusedOptions)

/** An edit to a question. Where it's asked doesn't change. */
export const customFieldUpdateSchema = questionFieldsSchema.superRefine(withOptionRules).transform(dropUnusedOptions)

export type CustomFieldCreateInput = z.input<typeof customFieldCreateSchema>
export type CustomFieldUpdateInput = z.input<typeof customFieldUpdateSchema>

/** Every question of one kind, in the new order. */
export const customFieldOrderSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  ids: z.array(z.guid()).refine((ids) => new Set(ids).size === ids.length, { message: "Each question can only appear once" }),
})
