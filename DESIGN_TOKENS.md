# Design tokens and Base UI conventions

> **Status: DRAFT, provisional.** Engineering proposal, pending design sign-off
> (Sherry, Thursday design session; admin structure with Jay). Nothing here is
> agreed yet.
>
> The contract is **agreed** when design has confirmed, for each token in the
> table below, its name and either a value or an explicit "keep the current
> value". Each row's status then changes to `agreed`, and the sign-off is
> recorded in the [Decision log](#decision-log).
>
> This document does **not** change any code. Writing the agreed values into
> `src/app/globals.css` and the Tailwind theme is separate work (FOR-45).
>
> **Update (FOR-103):** `globals.css` now holds the light values from the Figma
> "Design System [ShadCN]" semantic tokens, plus the extra `brand`, `selected`,
> `info`, `success`, `warning` and `destructive-muted` colours, the Figma radius
> steps, and the type scale (`text-header-*`, `text-body-*`, `text-caption-*`).
> Each value's comment names its Figma token. Dark values are derived, pending
> design review. The tables below are the pre-FOR-103 proposal.

Status legend:

| Status | Meaning |
| --- | --- |
| `provisional` | Name proposed by engineering; current value kept until design confirms or replaces it. Safe to build against. |
| `open` | Needs a design decision. Build against the name, not the value. |
| `agreed` | Confirmed by design. None yet. |

## How tokens reach components

- Values live as CSS variables in `src/app/globals.css`: `:root` (light) and
  `.dark` (dark).
- `@theme inline` maps each one into Tailwind v4, e.g.
  `--color-primary: var(--primary)` generates `bg-primary`, `text-primary`,
  `border-primary`, `ring-primary`, and so on. There is no `tailwind.config`
  file (`components.json` has `"config": ""`).
- So one edit to `--primary` updates every component that uses `bg-primary`.
  Components never hard-code colors, so design changes values, not components.
- Colors are written in **oklch** (`oklch(lightness chroma hue)`, optionally
  `/ alpha`). Design can supply hex; engineering converts.
- Opacity modifiers derive tints from a token (`bg-primary/80`,
  `ring-ring/50`, `bg-destructive/10`), so hover and focus shades need no
  extra tokens.
- Starting point: shadcn `base-nova` style with the `neutral` base color
  (`components.json`). Every current value below is that stock default; no
  project branding exists yet.

## Token contract

Current values copied from `src/app/globals.css`. "Proposed" is
engineering's suggestion; "TBD" means design decides.

### Brand colors

| Token | Purpose / where used | Current light | Current dark | Proposed | Status |
| --- | --- | --- | --- | --- | --- |
| `--primary` | Main action color: default `Button`, default `Badge`, `link` button text | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | TBD: brand color | `open` |
| `--primary-foreground` | Text/icons on `--primary` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | TBD: must pass contrast on `--primary` | `open` |
| `--secondary` | Lower-emphasis actions: `secondary` `Button` and `Badge` variants | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | TBD | `open` |
| `--secondary-foreground` | Text on `--secondary` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | TBD | `open` |
| `--accent` | Highlight of the focused/hovered item in menus (`DropdownMenu`, `Select` items). Not a brand accent. | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Keep neutral; brand accent, if needed, gets its own name | `open` |
| `--accent-foreground` | Text on `--accent` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Follows `--accent` | `open` |

Note for design: in shadcn, `--accent` means "interactive highlight", not
"brand accent color". If the Figma kit has a brand accent, map it to
`--primary` or propose a new token; do not repurpose `--accent`.

### Surface neutrals

| Token | Purpose / where used | Current light | Current dark | Proposed | Status |
| --- | --- | --- | --- | --- | --- |
| `--background` | Page background (`body`) | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Keep | `provisional` |
| `--foreground` | Default text (`body`) | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Keep | `provisional` |
| `--card` | `Card` surface | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Keep | `provisional` |
| `--card-foreground` | Text in `Card` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Keep | `provisional` |
| `--popover` | `Dialog`, `DropdownMenu`, `Select` popups | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Keep | `provisional` |
| `--popover-foreground` | Text in popups | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Keep | `provisional` |
| `--muted` | Subdued fills: table row hover/selected, dialog footer, ghost/outline hover | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Keep | `provisional` |
| `--muted-foreground` | Secondary text: descriptions, placeholders, icons | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Keep; check contrast on `--muted` | `provisional` |
| `--border` | Default border on every element (`* { border-border }`) | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Keep | `provisional` |
| `--input` | Form control borders (`Input`, `Select`); dark-mode control fill | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Keep | `provisional` |
| `--ring` | Focus ring (`focus-visible:ring-ring/50`, default `outline-ring/50`) | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | TBD: neutral or brand? | `open` |

All neutrals are pure grey (chroma `0`). Whether to warm or cool them is an
open question.

### Status colors

| Token | Purpose / where used | Current light | Current dark | Proposed | Status |
| --- | --- | --- | --- | --- | --- |
| `--destructive` | Errors and dangerous actions: `destructive` `Button`/`Badge`/menu item, `aria-invalid` borders | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Red, but current value fails contrast (see below) | `open` |

There is no `--destructive-foreground`: destructive UI uses `text-destructive`
on a `bg-destructive/10` tint. In light mode that pairing is about 4.4:1, below
the 4.5:1 WCAG AA minimum for normal text (4.8:1 on plain white), so the value
must be darkened or re-checked for contrast before sign-off. There are no success, warning, or info tokens.
If design needs them, engineering proposes `--success`, `--warning`, `--info`
(each tinted the same way), added in FOR-45 once agreed. Status: `open`.

### Sidebar and charts (defined, currently unused)

| Token | Current light | Current dark | Status |
| --- | --- | --- | --- |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | `open` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | `open` |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` | `open` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | `open` |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `open` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | `open` |
| `--sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | `open` |
| `--sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | `open` |
| `--chart-1` | `oklch(0.87 0 0)` | `oklch(0.87 0 0)` | `open` |
| `--chart-2` | `oklch(0.556 0 0)` | `oklch(0.556 0 0)` | `open` |
| `--chart-3` | `oklch(0.439 0 0)` | `oklch(0.439 0 0)` | `open` |
| `--chart-4` | `oklch(0.371 0 0)` | `oklch(0.371 0 0)` | `open` |
| `--chart-5` | `oklch(0.269 0 0)` | `oklch(0.269 0 0)` | `open` |

No component on `main` uses `bg-sidebar*` or `*-chart-*` yet. Proposal: the
admin shell's side navigation uses the `--sidebar-*` set (so the nav can differ
from the page background), and reports use `--chart-1`..`--chart-5`. Both
need design values; the current charts are greyscale and the dark
`--sidebar-primary` is the only blue in the theme (shadcn default, not a brand
choice).

### Radius

| Token | Derivation | Current | Tailwind class | Status |
| --- | --- | --- | --- | --- |
| `--radius` | Base value | `0.625rem` (10px) | — | `provisional` |
| `--radius-sm` | `calc(var(--radius) * 0.6)` | 6px | `rounded-sm` | `provisional` |
| `--radius-md` | `calc(var(--radius) * 0.8)` | 8px | `rounded-md` | `provisional` |
| `--radius-lg` | `var(--radius)` | 10px | `rounded-lg` (buttons, inputs, menus) | `provisional` |
| `--radius-xl` | `calc(var(--radius) * 1.4)` | 14px | `rounded-xl` (cards, dialogs) | `provisional` |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` | 18px | `rounded-2xl` | `provisional` |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` | 22px | `rounded-3xl` | `provisional` |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` | 26px | `rounded-4xl` (badges) | `provisional` |

Design picks one number (`--radius`); the scale follows. Small button sizes
also cap radius (`rounded-[min(var(--radius-md),10px)]`).

### Typography

| Token | Current mapping (`@theme inline`) | Font loaded in `layout.tsx` | Proposed | Status |
| --- | --- | --- | --- | --- |
| `--font-sans` | `var(--font-sans)` (refers to itself) | Geist, as `--font-geist-sans` | Geist | `provisional` |
| `--font-heading` | `var(--font-sans)` | — | Same as sans unless design picks a display face | `open` |
| `--font-mono` | `var(--font-geist-mono)` | Geist Mono, as `--font-geist-mono` | Geist Mono | `provisional` |

Known issue on `main`: `--font-sans` refers to itself, and the Geist variable
`layout.tsx` sets is `--font-geist-sans`, which nothing reads, so the sans font
is not Geist in the browser today. Mono is wired correctly. The fix
(`--font-sans: var(--font-geist-sans)`) is already in PR #14 (FOR-37) and lands
with it. There is no type scale token; components use Tailwind's default sizes
(`text-sm`, `text-base`, `text-xs`).

### Dark mode

`.dark` values exist, and components carry `dark:` variants
(`@custom-variant dark (&:is(.dark *))`), but nothing adds the `dark` class to
the page. The app is light-only today. Whether dark mode is in scope is an open
question; if it is not, design only needs to confirm the light column.

## Base UI composition conventions

`components.json` uses the shadcn **`base-nova`** style. Its primitives come
from [Base UI](https://base-ui.com) (`@base-ui/react`), **not Radix**. That
changes how components are composed and styled.

### `render` prop, not `asChild`

To make one component render as another (a trigger that is a `Button`, a nav
item that is a Next.js `Link`), pass the element to `render`. `asChild` does
not exist here and is never used in this repo.

```tsx
// Do (src/app/page.tsx)
<DialogTrigger render={<Button>Review</Button>} />

<DropdownMenuTrigger
  render={
    <Button variant="outline" size="icon" aria-label="Project menu">
      <MoreHorizontalIcon />
    </Button>
  }
/>

// Do (src/components/ui/dialog.tsx)
<DialogPrimitive.Close render={<Button variant="outline" />}>
  Close
</DialogPrimitive.Close>

// Don't (Radix / shadcn default-style syntax; not supported)
<DialogTrigger asChild>
  <Button>Review</Button>
</DialogTrigger>
```

Same pattern on the admin shell branch (`feature/admin-shell`, not yet on
`main`): `<Drawer.Trigger render={<Button … />}>` and
`<NavLink render={<Link href={href} />}>`.

### `useRender` for custom components

A component of ours that should accept `render` uses Base UI's `useRender`
(with `mergeProps`), as `src/components/ui/badge.tsx` does:

```tsx
function Badge({ className, variant = "default", render, ...props }:
  useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  })
}
```

So `<Badge render={<Link href="/x" />}>` renders a link styled as a badge.

### State is styled with Base UI data attributes

Base UI exposes state as individual data attributes, not Radix's single
`data-state="open|closed|checked|active"`. Tailwind v4 targets them directly:

| State | Base UI attribute (used here) | Radix equivalent |
| --- | --- | --- |
| Open / closed | `data-open`, `data-closed` (dialog, menu, select animations) | `data-[state=open]` |
| Enter / exit animation | `data-starting-style`, `data-ending-style` (admin shell drawer) | `data-[state=open]` + keyframes |
| Selected tab | `data-active` (`tabs.tsx`) | `data-[state=active]` |
| Disabled item | `data-disabled` | `data-disabled` |
| Trigger with popup open | `data-popup-open` | `data-[state=open]` on trigger |
| Popup placement | `data-[side=top\|bottom\|left\|right]` | `data-side` |
| Orientation | `data-orientation="horizontal\|vertical"` (Tailwind shorthand variants `data-horizontal:` / `data-vertical:` come from `shadcn/tailwind.css`) | `data-orientation` |

Every primitive also sets `data-slot="…"` (e.g. `data-slot="button"`) so
parents can style children (`*:data-[slot=select-value]:…`).

One leftover: `TableRow` (`src/components/ui/table.tsx`) styles
`data-[state=selected]:bg-muted`. Table is plain HTML, not Base UI, so nothing
sets that attribute automatically; a consumer must pass `data-state="selected"`
itself.

### Why this matters for design

Most Figma shadcn kits are drawn from the Radix version. Visual output is
similar, but anatomy and states can differ:

- A Figma "Button inside DialogTrigger" is one element in code (the trigger
  *is* the button), not two layers.
- Base UI popups have a separate `Backdrop`, `Portal`, `Popup`, and sometimes
  `Viewport` part; animation states are enter/exit, not open/closed keyframes.
- Some Radix-only parts or props in the kit may have no Base UI counterpart,
  and the reverse.

## Figma kit compatibility

The Figma kit is **not assumed to map one-to-one** to the components in
`src/components/ui`. Before a kit component is treated as the spec, check:

1. Token names in the kit match the table above (`primary`, `muted`, `accent`,
   etc.), and `accent` means the same thing.
2. Variants match code: `Button` has `default`, `outline`, `secondary`,
   `ghost`, `destructive`, `link` and sizes `xs`, `sm`, `default`, `lg`,
   `icon-xs`, `icon-sm`, `icon`, `icon-lg`. `Badge` and `Tabs` have their own
   lists in their files.
3. Which states the kit draws (hover, focus-visible, disabled, `aria-invalid`,
   open, selected) and whether each exists in code.
4. Radius and sizes match the scale above (e.g. buttons are `h-8`, `rounded-lg`).
5. Parts the kit shows that are not installed. Installed: `button`, `input`,
   `label`, `card`, `dialog`, `dropdown-menu`, `select`, `table`, `badge`,
   `tabs`. Anything else needs `npx shadcn@latest add` first, in base-nova
   form.

Mismatches go to the open questions below rather than into component code.

## Open questions for design

1. **Brand colors**: what are `--primary` and `--secondary` (light, and dark if
   in scope)? Hex is fine. The admin dashboard mock-up uses `#2563eb`
   (Tailwind blue-600) for its primary "Create Event" button; confirm that is
   the primary.
2. **Brand accent**: does the brand have an accent color separate from
   `--primary`? (Kept separate from shadcn's `--accent`, see above.)
3. **Neutrals**: keep pure grey, or warm/cool them? The mock-up uses Tailwind
   "stone" (slightly warm): page `#fafaf9`, sidebar `#f5f5f4`, active nav item
   `#e7e5e4`. Confirm stone is the neutral ramp.
4. **Radius**: keep `0.625rem` (10px) or pick another base?
5. **Dark mode**: in scope for launch? If not, light values only.
6. **Focus ring**: neutral grey (current) or brand-tinted? Must stay visible on
   every surface.
7. **Status colors**: is the current red right for `--destructive`? Are
   success, warning, info needed (badges, form messages, toasts)?
8. **Typography**: Geist for body and headings? Is a type scale (sizes,
   weights, line heights) needed beyond Tailwind defaults?
9. **Charts**: palette for `--chart-1`..`--chart-5` (reports).
10. **Figma kit**: which kit, and is it Radix-based? Who owns keeping it in
    sync with code?
11. **Admin structure (Jay)**: the admin dashboard design doc gives a first
    answer (see the Decision log, provisional): confirm it is final, and where
    "Create Event" and the account menu live on smaller screens.

## Out of scope and next steps

- **FOR-45**: write the agreed values into `src/app/globals.css` and the
  `@theme inline` mapping, and add any new tokens
  (success/warning/info) that design approves.
- **FOR-36, FOR-47**: consume the tokens in components; build against token
  names now, values may change.
- This document claims no token application. Update the status columns and the
  decision log when design signs off.

## Decision log

| Date | Decision | Who |
| --- | --- | --- |
| 2026-11-05 | **Provisional, not yet confirmed.** From the admin dashboard design doc: sidebar sits on its own surface (`#f5f5f4`, so `--sidebar-*` gets used) with the active item on `#e7e5e4`. Structure top to bottom: org name, primary "Create Event" button, nav (Overview; Volunteers with sub-items All Volunteers and Applications; Events; Reporting & Analytics), then Settings and the signed-in user's account menu pinned to the bottom. | Design team doc, via Ethan |
