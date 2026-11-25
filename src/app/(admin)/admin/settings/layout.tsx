import { Suspense } from "react"

import { requireRole } from "@/features/auth"
import { SettingsNav } from "@/features/settings"

// Every settings page is admin-only. Each page still calls requireRole itself,
// since a layout's check can't gate what its pages return.
async function RequireAdmin({ children }: { children: React.ReactNode }) {
  await requireRole("admin")

  return children
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RequireAdmin>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">How your organization is set up and what it asks volunteers.</p>
          </div>
          <SettingsNav />
          {children}
        </div>
      </RequireAdmin>
    </Suspense>
  )
}
