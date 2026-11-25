"use client"

import type { ReactNode } from "react"
import {
  ChartColumnIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PartyPopperIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { AppShell, type NavItem } from "./AppShell"

export type AdminNavItem = NavItem & {
  // Shown only when the shell's `isAdmin` is true, e.g. settings managers can't open.
  adminOnly?: boolean
}

// Mirrors the Figma "AppSidebar / Inset" component (Design System [ShadCN], Sidebar page).
export const DEFAULT_ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboardIcon },
  { label: "Volunteers", href: "/admin/volunteers", icon: UsersIcon },
  { label: "Applications", href: "/admin/applications", icon: FileTextIcon },
  { label: "Events", href: "/admin/events", icon: PartyPopperIcon },
  { label: "Analytics", href: "/admin/analytics", icon: ChartColumnIcon },
]

// Pinned above the account menu at the bottom of the sidebar.
export const DEFAULT_ADMIN_UTILITY_NAV_ITEMS: AdminNavItem[] = [
  { label: "Settings", href: "/admin/settings", icon: SettingsIcon, adminOnly: true },
]

type AdminShellProps = {
  children: ReactNode
  navItems?: AdminNavItem[]
  utilityNavItems?: AdminNavItem[]
  // Rendered in the sidebar footer, e.g. <AccountMenu />. Server-rendered by the layout.
  account?: ReactNode
  title?: string
  // Shows the adminOnly items; leave it out for managers. Only hides links,
  // so each page still checks the role itself.
  isAdmin?: boolean
}

export function AdminShell({
  navItems = DEFAULT_ADMIN_NAV_ITEMS,
  utilityNavItems = DEFAULT_ADMIN_UTILITY_NAV_ITEMS,
  isAdmin = false,
  ...props
}: AdminShellProps) {
  const visible = (item: AdminNavItem) => isAdmin || !item.adminOnly
  return (
    <AppShell
      navLabel="Admin"
      navItems={navItems.filter(visible)}
      utilityNavItems={utilityNavItems.filter(visible)}
      collapsible="icon"
      {...props}
    />
  )
}
