"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useId, useState, type ComponentType, type ReactNode } from "react"
import {
  ChartColumnIcon,
  CommandIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PartyPopperIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { Drawer } from "@base-ui/react/drawer"
import { useRender } from "@base-ui/react/use-render"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type AdminNavItem = {
  label: string
  href: string
  icon?: ComponentType<{ className?: string }>
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
  { label: "Settings", href: "/admin/settings", icon: SettingsIcon },
]

type AdminShellProps = {
  children: ReactNode
  navItems?: AdminNavItem[]
  utilityNavItems?: AdminNavItem[]
  // Rendered in the sidebar footer, e.g. <AccountMenu />. Server-rendered by the layout.
  account?: ReactNode
  title?: string
}

export function AdminShell({
  children,
  navItems = DEFAULT_ADMIN_NAV_ITEMS,
  utilityNavItems = DEFAULT_ADMIN_UTILITY_NAV_ITEMS,
  account,
  title = "UW Blueprint",
}: AdminShellProps) {
  const pathname = usePathname()
  const pageTitle =
    [...navItems, ...utilityNavItems].find((item) => isActive(pathname, item.href))?.label ?? title
  // Desktop: full sidebar vs icon rail. Mobile: closed vs overlay drawer.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navId = useId()

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      {/* Desktop sidebar. `hidden` (display: none) on mobile keeps its links out of the tab order. */}
      <aside
        id={navId}
        data-collapsed={collapsed}
        className={cn(
          "group/sidebar sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-64"
        )}
      >
        <SidebarHeader title={title} collapsed={collapsed} />
        <AdminNav
          navItems={navItems}
          utilityNavItems={utilityNavItems}
          pathname={pathname}
          collapsed={collapsed}
        />
        {account && <div className="p-2">{account}</div>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4">
          {/* Mobile drawer. Base UI unmounts it while closed, traps focus while open,
              closes on Escape / outside click, and returns focus to the trigger. */}
          <Drawer.Root open={mobileOpen} onOpenChange={setMobileOpen} swipeDirection="left">
            <Drawer.Trigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <MenuIcon />
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Backdrop className="fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
              <Drawer.Viewport className="fixed inset-0 z-40 pointer-events-none">
                <Drawer.Popup
                  className={cn(
                    "pointer-events-auto fixed inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground outline-none",
                    "translate-x-(--drawer-swipe-movement-x) transition-transform duration-200",
                    "data-ending-style:-translate-x-full data-starting-style:-translate-x-full"
                  )}
                >
                  <div className="flex h-14 items-center justify-between px-3">
                    <Drawer.Title className="flex min-w-0 items-center gap-2 font-medium">
                      <CommandIcon className="size-5 shrink-0" />
                      <span className="truncate">{title}</span>
                    </Drawer.Title>
                    <Drawer.Close
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Close navigation" />
                      }
                    >
                      <XIcon />
                    </Drawer.Close>
                  </div>
                  <AdminNav
                    navItems={navItems}
                    utilityNavItems={utilityNavItems}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  {account && <div className="p-2">{account}</div>}
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>

          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls={navId}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
          <span className="font-medium">{pageTitle}</span>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarHeader({ title, collapsed }: { title: string; collapsed: boolean }) {
  return (
    <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
      <CommandIcon className="size-5 shrink-0" aria-hidden />
      <span className={cn("truncate font-medium", collapsed && "sr-only")}>{title}</span>
    </div>
  )
}

type AdminNavProps = {
  navItems: AdminNavItem[]
  utilityNavItems: AdminNavItem[]
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
}

function AdminNav({
  navItems,
  utilityNavItems,
  pathname,
  collapsed = false,
  onNavigate,
}: AdminNavProps) {
  const renderItems = (items: AdminNavItem[]) =>
    items.map(({ label, href, icon: Icon }) => {
      const active = isActive(pathname, href)
      return (
        <li key={href}>
          <NavLink
            render={<Link href={href} />}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-lg px-2 text-sm outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
              // Selected = brand tint (Figma bg/selected + text/brand); hover = neutral (bg/hover).
              active
                ? "bg-selected text-brand"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            {Icon && <Icon />}
            <span className={cn(collapsed && "sr-only")}>{label}</span>
          </NavLink>
        </li>
      )
    })

  return (
    <nav aria-label="Admin" className="flex flex-1 flex-col overflow-y-auto p-2">
      <ul className="flex flex-col gap-1">{renderItems(navItems)}</ul>
      {utilityNavItems.length > 0 && (
        <ul className="mt-auto flex flex-col gap-1 pt-2">{renderItems(utilityNavItems)}</ul>
      )}
    </nav>
  )
}

// Base UI `render` composition: the caller's element (e.g. next/link) becomes the
// rendered node, so it stays a real link instead of a role="button" element.
function NavLink({ render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({ defaultTagName: "a", render, props })
}
