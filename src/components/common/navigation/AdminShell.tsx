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
  // Desktop: full sidebar vs icon rail. Mobile: hidden vs overlay drawer.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navId = useId()

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id={navId}
        data-collapsed={collapsed}
        data-mobile-open={mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r bg-background transition-[width,transform] duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // On desktop the sidebar sits in normal flow so main content never overlaps it.
          "md:sticky md:top-0 md:h-svh md:translate-x-0",
          collapsed ? "md:w-14" : "md:w-60"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-3">
          <span className={cn("truncate font-semibold", collapsed && "md:sr-only")}>
            {title}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <XIcon />
          </Button>
        </div>

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
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      buttonVariants({ variant: active ? "secondary" : "ghost" }),
                      "w-full justify-start",
                      collapsed && "md:justify-center md:px-0"
                    )}
                  >
                    {Icon && <Icon />}
                    <span className={cn(collapsed && "md:sr-only")}>{label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open navigation"
            aria-controls={navId}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
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

// Base UI `render` composition: the caller's element (e.g. next/link) becomes the
// rendered node, so it stays a real link instead of a role="button" element.
function NavLink({ render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({ defaultTagName: "a", render, props })
}
