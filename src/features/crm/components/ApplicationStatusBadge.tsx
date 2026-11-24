import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/lib/supabase/database.types"

const LABELS: Record<Enums<"volunteer_status">, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

// Same colours as the volunteer profile's status badge.
const VARIANTS = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
} as const

export function ApplicationStatusBadge({ status }: { status: Enums<"volunteer_status"> }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
}
