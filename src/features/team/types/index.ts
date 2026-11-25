import type { AppRole } from "@/lib/adapters/types"

export interface TeamMember {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  role: AppRole
  /** True for the caller's own row — the page disables role controls on it. */
  isCurrentUser: boolean
}

export interface UnusedInvite {
  id: string
  email: string
  role: AppRole
  createdAt: string
  expiresAt: string
}
