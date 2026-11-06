import { AdminShell } from "@/components/common/navigation"

// Server component: route-level auth checks belong here, not inside AdminShell.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell>{children}</AdminShell>
}
