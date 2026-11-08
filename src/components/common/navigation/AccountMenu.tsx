"use client"

import { useRouter } from "next/navigation"
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AccountMenuProps = {
  name: string
  email: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

// Sidebar footer from the Figma "AppSidebar" (avatar, name, email, chevrons).
// Inside the collapsed desktop rail only the avatar shows.
export function AccountMenu({ name, email }: AccountMenuProps) {
  const router = useRouter()

  async function signOut() {
    // signOut reports failure via `error` instead of throwing; stay put if the session survived.
    const { error } = await createBrowserSupabaseClient().auth.signOut()
    if (error) {
      console.error("Sign out failed", error)
      return
    }
    router.replace("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
          "group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-0"
        )}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground"
        >
          {initials(name)}
        </span>
        <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsed=true]/sidebar:hidden">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 group-data-[collapsed=true]/sidebar:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
