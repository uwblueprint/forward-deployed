"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

// Each settings page is admin-only. Add new ones here, e.g. Team.
export const SETTINGS_NAV_ITEMS = [{ label: "Organization", href: "/admin/settings" }]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Settings" className="flex gap-1 border-b">
      {SETTINGS_NAV_ITEMS.map(({ label, href }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
