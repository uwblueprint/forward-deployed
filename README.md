# Forward Deployed

A Next.js App Router scaffold with TypeScript, Tailwind CSS v4, ESLint, and the
shadcn/ui base primitives already installed.

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, `src/` directory) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (`base-nova` style, `neutral` base color) |
| Icons | lucide-react |
| Linting | ESLint (`eslint-config-next`) |
| Import alias | `@/*` → `src/*` |

## Getting started

```bash
npm install
npm run dev
```

The dev server defaults to <http://localhost:3000>. Pass `-p <port>` to pick a
different one, e.g. `npm run dev -- -p 43127`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project layout

```
src/
  app/
    layout.tsx      Root layout, fonts, metadata
    page.tsx        Demo page exercising every installed primitive
    globals.css     Tailwind entrypoint + shadcn design tokens
  components/
    ui/             shadcn/ui primitives (owned by this repo, edit freely)
  lib/
    utils.ts        Re-exports the `cn` class-name helper
components.json     shadcn/ui CLI configuration
```

## Installed UI primitives

`button`, `input`, `label`, `card`, `dialog`, `dropdown-menu`, `select`,
`table`, `badge`, `tabs`.

Add more with:

```bash
npx shadcn@latest add <component>
```

shadcn/ui components are copied into `src/components/ui`, so they are normal
source files — edit them directly instead of overriding them from the outside.

Note that this shadcn style is built on [Base UI](https://base-ui.com), not
Radix. Composition uses the `render` prop rather than `asChild`:

```tsx
<DialogTrigger render={<Button>Open</Button>} />
```
