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

## Contributing

| Rule | Detail |
| --- | --- |
| Branch protection | `main` is protected. No direct pushes; all changes go through a pull request. |
| CI | Checks must pass before a PR can merge. |
| Approvals | Not required. Once checks are green, authors can merge their own PR. |
| Code owners | `.github/CODEOWNERS` auto-requests reviewers for visibility only. Approval is not required. |
| Branch naming | Generally `<type>/<short-description>`, e.g. `feature/add-search-bar`. Treat this as a guideline, not a strict rule. |

## Project layout

The codebase is organized by feature, not by technical layer. Each domain owns
its own `api`, `components`, `hooks`, `schemas`, and `types` directories.

```
src/
  app/                  Next.js App Router routes (thin router glue only)
  features/             Domain-isolated feature modules
    auth/
    volunteers/
    events/
    crm/
    reports/
      api/              Server calls for this domain
      components/       UI owned by this domain
      hooks/            Stateful logic for this domain
      schemas/          Validation schemas
      types/            Domain types
      index.ts          Public barrel — the only supported import path
  components/
    ui/                 Base atomic shadcn primitives
    common/             Un-opinionated composed patterns
      data-table/
      forms/
      navigation/
      metrics/
  lib/
    api-client.ts       Typed fetch wrapper (`apiClient`, `ApiError`)
    utils.ts            Re-exports the `cn` class-name helper
components.json         shadcn/ui CLI configuration
```

### Import rules

Import a feature only through its barrel, never by reaching into its internals:

```ts
import { VolunteerTable } from "@/features/volunteers"   // yes
import { VolunteerTable } from "@/features/volunteers/components/volunteer-table" // no
```

Anything not exported from a feature's `index.ts` is private to that feature.
Code shared across two or more features belongs in `src/components/common` or
`src/lib` instead.

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
