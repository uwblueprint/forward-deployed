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
| Testing | Vitest (`jsdom` environment, jest-dom matchers) |
| Import alias | `@/*` → `src/*` |

## Getting started

Use Node 24, the version pinned in `.nvmrc` and used by CI (`nvm use` picks it
up).

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
| `npm run typecheck` | Generate Next.js route types, then run `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

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

The `shadcn` package is a dev dependency: the CLI only runs at authoring time,
and `src/app/globals.css` imports `shadcn/tailwind.css` at build time. Do not
remove it outright — the build fails, and dropping the import silently breaks
the `data-horizontal`/`data-vertical` variants the Tabs primitive relies on.

## Dependency advisories

Check what ships to users with:

```bash
npm audit --omit=dev
```

Never run `npm audit fix --force`. It was found to downgrade `shadcn` to 1.0.0.
Plain `npm audit fix` (no `--force`) is safe.

### Accepted dev-only advisories

Advisories that come only through dev tooling — the `shadcn` CLI and the
`eslint-config-next` toolchain — never reach the production bundle. They are
accepted: patch them with `npm audit fix` when a fix lands, but they do not
block a merge.

Currently open (as of 2026-11-03; `npm audit --omit=dev` reports none). No
non-breaking fix exists yet; `npm audit fix --force` would downgrade `eslint`
to 4.0.0 and `shadcn` to 1.0.0.

| Package | Severity | Reached through | Advisories |
| --- | --- | --- | --- |
| `minimatch` | moderate | `eslint`, `eslint-config-next` plugins, `typescript-eslint`, `shadcn` → `ts-morph` | GHSA-g3hv-75wg-m249 |
| `deepmerge` | low | `shadcn` → `@shadcn/registry` | GHSA-gcqx-w48m-w2h4 |

Historical record: the table below lists the dev-only advisories found on
2026-10-25. All of them were cleared that day by `npm audit fix`.

| Package | Severity | Reached through | Advisories |
| --- | --- | --- | --- |
| `undici` | high | `shadcn` CLI | GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c |
| `zod` (v3 copies) | high | `shadcn`, `@shadcn/registry` | GHSA-mrhx-c7xc-m3w5 |
| `body-parser` | high | `shadcn` → `@modelcontextprotocol/sdk` → `express` | GHSA-27r3-jxmh-p828 |
| `fast-uri` | moderate | `shadcn` → `@modelcontextprotocol/sdk` → `ajv` | GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp |
| `ip-address` | moderate | `shadcn` → `socks` / `express-rate-limit` | GHSA-rxp7-6hxx-x8q5 |
| `@shadcn/registry` | high | `shadcn` | inherits the `zod` advisory |
| `shadcn` | high | direct (dev) | inherits the `zod` advisory |

Runtime advisories (anything `npm audit --omit=dev` reports) are never accepted
here — fix them. For example, `next` and `eslint-config-next` were bumped off the
vulnerable 16.4.0 baseline (to 16.4.3, then 16.4.5) for GHSA-2464-fhr4-w9xw,
GHSA-p3m5-59mp-jv5r, and GHSA-673q-mjm6-r5xr, all fixed in 16.4.1. Keep the
two versions in lockstep.
