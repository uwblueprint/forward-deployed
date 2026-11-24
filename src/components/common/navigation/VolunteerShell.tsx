"use client"

import type { ReactNode } from "react"
import { CalendarCheckIcon, HouseIcon, PartyPopperIcon, UserIcon } from "lucide-react"

import { AppShell, type NavItem } from "./AppShell"

// Figma "AppSidebar" Volunteer variant (FD-Designs, Volunteer Dashboard hi-fi screens).
export const DEFAULT_VOLUNTEER_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: HouseIcon },
  { label: "Events", href: "/events", icon: PartyPopperIcon },
  { label: "My events", href: "/my-events", icon: CalendarCheckIcon },
]

// Sits where the Figma variant pins its utility link, above the account menu.
export const DEFAULT_VOLUNTEER_UTILITY_NAV_ITEMS: NavItem[] = [
  { label: "Profile", href: "/profile", icon: UserIcon },
]

type VolunteerShellProps = {
  children: ReactNode
  navItems?: NavItem[]
  utilityNavItems?: NavItem[]
  // Rendered in the sidebar footer, e.g. <AccountMenu />. Server-rendered by the layout.
  account?: ReactNode
  title?: string
}

// Same shell as the admin area, with the Volunteer variant's behaviour: the desktop
// sidebar hides (offcanvas) instead of collapsing to icons, and the phone header
// keeps the page title on the left with the menu button on the right.
export function VolunteerShell({
  navItems = DEFAULT_VOLUNTEER_NAV_ITEMS,
  utilityNavItems = DEFAULT_VOLUNTEER_UTILITY_NAV_ITEMS,
  ...props
}: VolunteerShellProps) {
  return (
    <AppShell
      navLabel="Volunteer"
      navItems={navItems}
      utilityNavItems={utilityNavItems}
      collapsible="offcanvas"
      mobileMenuSide="end"
      {...props}
    />
  )
}
