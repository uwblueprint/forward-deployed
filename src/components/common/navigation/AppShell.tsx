"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react"
import { CommandIcon, MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, XIcon } from "lucide-react"

import { Drawer } from "@base-ui/react/drawer"
import { useRender } from "@base-ui/react/use-render"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type NavItem = {
  label: string
  href: string
  icon?: ComponentType<{ className?: string }>
}

// Figma "AppSidebar" variants. Admin collapses to an icon rail; the Volunteer
// variant (288px) is offcanvas: collapsing hides it instead of leaving a rail.
const SIDEBAR_VARIANTS = {
  icon: { expanded: "w-64", collapsed: "w-14" },
  offcanvas: { expanded: "w-72", collapsed: "invisible w-0 border-r-0" },
} as const

export type AppShellProps = {
  children: ReactNode
  navItems: NavItem[]
  // Pinned above the account menu at the bottom of the sidebar.
  utilityNavItems?: NavItem[]
  // Accessible name of the <nav>, e.g. "Admin" or "Volunteer".
  navLabel: string
  // Rendered in the sidebar footer, e.g. <AccountMenu />. Server-rendered by the layout.
  account?: ReactNode
  title?: string
  collapsible?: keyof typeof SIDEBAR_VARIANTS
  // Which end of the header holds the mobile menu button.
  mobileMenuSide?: "start" | "end"
}

export function AppShell({
  children,
  navItems,
  utilityNavItems = [],
  navLabel,
  account,
  title = "UW Blueprint",
  collapsible = "icon",
  mobileMenuSide = "start",
}: AppShellProps) {
  const pathname = usePathname()
  const activeItem = findActiveItem(pathname, [...navItems, ...utilityNavItems])
  const pageTitle = activeItem?.label ?? title
  // Desktop: full sidebar vs collapsed (rail or hidden). Mobile: closed vs overlay drawer.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navId = useId()
  const widths = SIDEBAR_VARIANTS[collapsible]
  // Only the icon variant renders a compact rail; offcanvas is simply hidden.
  const rail = collapsible === "icon" && collapsed

  // The drawer is mobile-only: close it if the viewport grows to desktop width,
  // or its modal backdrop would keep trapping focus over the desktop sidebar.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)")
    const close = () => desktop.matches && setMobileOpen(false)
    desktop.addEventListener("change", close)
    return () => desktop.removeEventListener("change", close)
  }, [])

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      {/* Desktop sidebar. `hidden` (display: none) on mobile keeps its links out of the tab order. */}
      <aside
        id={navId}
        data-collapsed={rail}
        className={cn(
          "group/sidebar sticky top-0 hidden h-svh shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? widths.collapsed : widths.expanded
        )}
      >
        <SidebarHeader title={title} collapsed={rail} />
        <ShellNav
          label={navLabel}
          navItems={navItems}
          utilityNavItems={utilityNavItems}
          activeHref={activeItem?.href}
          collapsed={rail}
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
                  variant={mobileMenuSide === "end" ? "outline" : "ghost"}
                  size="icon-sm"
                  className={cn("md:hidden", mobileMenuSide === "end" && "order-last ml-auto")}
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
                    "pointer-events-auto fixed inset-y-0 left-0 flex max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground outline-none",
                    widths.expanded,
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
                  <ShellNav
                    label={navLabel}
                    navItems={navItems}
                    utilityNavItems={utilityNavItems}
                    activeHref={activeItem?.href}
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
          <span className="truncate font-medium">{pageTitle}</span>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

// The most specific matching item, so /events/archive marks only an "/events/archive"
// link (when there is one) as current, not "/events" too.
function findActiveItem(pathname: string, items: NavItem[]) {
  return items
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce<NavItem | undefined>((best, item) => (!best || item.href.length > best.href.length ? item : best), undefined)
}

function SidebarHeader({ title, collapsed }: { title: string; collapsed: boolean }) {
  return (
    <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
      <CommandIcon className="size-5 shrink-0" aria-hidden />
      <span className={cn("truncate font-medium", collapsed && "sr-only")}>{title}</span>
    </div>
  )
}

type ShellNavProps = {
  label: string
  navItems: NavItem[]
  utilityNavItems: NavItem[]
  activeHref?: string
  collapsed?: boolean
  onNavigate?: () => void
}

function ShellNav({
  label,
  navItems,
  utilityNavItems,
  activeHref,
  collapsed = false,
  onNavigate,
}: ShellNavProps) {
  const renderItems = (items: NavItem[]) =>
    items.map(({ label: itemLabel, href, icon: Icon }) => {
      const active = href === activeHref
      return (
        <li key={href}>
          <NavLink
            render={<Link href={href} />}
            aria-current={active ? "page" : undefined}
            title={collapsed ? itemLabel : undefined}
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
            <span className={cn("truncate", collapsed && "sr-only")}>{itemLabel}</span>
          </NavLink>
        </li>
      )
    })

  return (
    <nav aria-label={label} className="flex flex-1 flex-col overflow-y-auto p-2">
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
