/**
 * Public API Barrel for team feature module.
 * EXPORT ONLY: Components, hooks, schemas, and types intended for external consumption.
 * DO NOT export internal sub-components or route-specific logic.
 */

export * from "./api"
export type { TeamMember, UnusedInvite } from "./types"
export { createInvitationSchema, revokeInvitationSchema, setUserRoleSchema } from "./schemas"
export type { CreateInvitationInput, RevokeInvitationInput, SetUserRoleInput } from "./schemas"
