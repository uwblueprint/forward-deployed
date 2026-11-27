import { z } from "zod"
import type { AppRole } from "@/lib/adapters/types"

const roleEnum = z.enum(["admin", "manager", "volunteer"] satisfies AppRole[], "Select a valid role.")

export const setUserRoleSchema = z.object({
  targetUserId: z.uuid("Enter a valid user id."),
  newRole: roleEnum,
})

export const createInvitationSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: roleEnum,
})

export const revokeInvitationSchema = z.object({
  invitationId: z.uuid("Enter a valid invitation id."),
})

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>
