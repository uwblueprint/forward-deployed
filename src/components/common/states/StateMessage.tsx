import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StateMessageProps = {
  title: string
  description?: ReactNode
  // Lucide icon component (not an element), e.g. `icon={InboxIcon}`.
  icon?: ComponentType<{ className?: string }>
  // Usually a <Button />, or a <Button nativeButton={false} render={<Link href="..." />} /> for navigation.
  action?: ReactNode
  // Heading level for the title. h2 inside a page; h1 when the state is the whole page.
  titleAs?: "h1" | "h2" | "h3"
  className?: string
}

// Private layout shared by EmptyState and ErrorState: centred icon, title,
// description, and an optional action. Not exported from the barrel.
export function StateMessage({
  title,
  description,
  icon: Icon,
  action,
  titleAs: Title = "h2",
  className,
  ...rest
}: StateMessageProps & Omit<React.ComponentProps<"div">, keyof StateMessageProps>) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center",
        className
      )}
      {...rest}
    >
      {Icon && (
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-5"
        >
          <Icon />
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <Title className="text-base font-medium text-foreground">{title}</Title>
        {/* div, not p: description is a ReactNode and may hold block content. */}
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}
