"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useId, useState, type ComponentType, type ReactNode } from "react"
import {
  CalendarIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { Drawer } from "@base-ui/react/drawer"
import { useRender } from "@base-ui/react/use-render"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type AdminNavItem = {
  label: string
  href: string
  icon?: ComponentType<{ className?: string }>
}

// Static placeholder links until real admin routes exist.
export const DEFAULT_ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboardIcon },
  { label: "Volunteers", href: "/admin/volunteers", icon: UsersIcon },
  { label: "Events", href: "/admin/events", icon: CalendarIcon },
]

type AdminShellProps = {
  children: ReactNode
  navItems?: AdminNavItem[]
  title?: string
}

export function AdminShell({
  children,
  navItems = DEFAULT_ADMIN_NAV_ITEMS,
  title = "Admin",
}: AdminShellProps) {
  const pathname = usePathname()
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
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-background transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-60"
        )}
      >
        <div className="flex h-14 items-center border-b px-3">
          <span className={cn("truncate font-semibold", collapsed && "sr-only")}>
            {title}
          </span>
        </div>
        <AdminNav navItems={navItems} pathname={pathname} collapsed={collapsed} />
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
                    "pointer-events-auto fixed inset-y-0 left-0 flex w-60 flex-col border-r bg-background outline-none",
                    "translate-x-(--drawer-swipe-movement-x) transition-transform duration-200",
                    "data-ending-style:-translate-x-full data-starting-style:-translate-x-full"
                  )}
                >
                  <div className="flex h-14 items-center justify-between border-b px-3">
                    <Drawer.Title className="truncate font-semibold">{title}</Drawer.Title>
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
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
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
          <span className="font-medium">{title}</span>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

type AdminNavProps = {
  navItems: AdminNavItem[]
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
}

function AdminNav({ navItems, pathname, collapsed = false, onNavigate }: AdminNavProps) {
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto p-2">
      <ul className="flex flex-col gap-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <NavLink
                render={<Link href={href} />}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                onClick={onNavigate}
                className={cn(
                  buttonVariants({ variant: active ? "secondary" : "ghost" }),
                  "w-full justify-start",
                  collapsed && "justify-center px-0"
                )}
              >
                {Icon && <Icon />}
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Base UI `render` composition: the caller's element (e.g. next/link) becomes the
// rendered node, so it stays a real link instead of a role="button" element.
function NavLink({ render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({ defaultTagName: "a", render, props })
}
