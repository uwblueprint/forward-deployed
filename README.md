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

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is
gitignored; never commit real keys. Ask the Supabase owner for the values
through the team's secure channel, not Slack plaintext.

| Variable | Where it runs | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | Holds the publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Server-only scripts | Secret key (`sb_secret_...`); bypasses RLS |

## Accounts & ownership

| Service | Owners | Other members |
| --- | --- | --- |
| Supabase (org "UW Blueprint", Blueprint-controlled account) | Allan Yang, Rishab (TL) | Samay, Ethan, Angus (Developer) |
| GitHub (`uwblueprint/forward-deployed`) | TBD | TBD |
| Vercel | Samay | None (Hobby plan, single-user) |

Secrets (Supabase keys, database password) live in: TBD.

To transfer ownership of an account:

1. An existing owner invites the new owner with the Owner role.
2. The new owner accepts the invite and confirms they can open the project settings.
3. Only then may the old owner leave or be downgraded. Every account must keep at least two owners.
4. Update the table above in the same pull request.

## Database

All schema changes go in migration files under `supabase/migrations/`. Never
change tables from the Supabase dashboard. Who can read or change what is
described in `docs/role-model.md`.

Local database (needs Docker):

```bash
npx supabase start      # start the local stack
npx supabase db reset   # rebuild the local database from the migrations
npx supabase test db    # run the access-control tests in supabase/tests/
npx supabase stop       # stop the local stack
```

Seed data:

```bash
npm run db:seed
```

The seed targets the project in `.env.local` and needs `SUPABASE_SECRET_KEY`.
It creates 10 rows per table, with 22 users: an admin per organization, two
managers, and 10 volunteers. All logins use `SEED_USER_PASSWORD`. Re-running
replaces only the seed's own rows.
Needs Node 22.18 or newer.

A new project with no seed data has no admins. See "First admin" in
`docs/role-model.md` for the two commands that create one.

## Authorization

Pages and layouts call `requireRole` from `@/features/auth`; route handlers
call `requireRoleForRoute` instead, since `redirect`/`notFound` don't fit an
API response. It returns a typed `{ ok: true, user }` /
`{ ok: false, response }` result instead of throwing.

Every server component that reads protected data must call `requireRole`
itself before reading that data, even inside a protected layout. Layouts
render in parallel with their pages, so a layout-level check can't gate what
a page returns.

`src/proxy.ts` is a convenience redirect for signed-out visitors, not the
security gate, and is not a substitute for `requireRole`/`requireRoleForRoute`
at each server boundary.

Roles are read per request from `public.users.role` (see
`docs/role-model.md`), deduplicated per request with React's `cache()`. Any
missing or unknown role is denied. Never read roles from `app_metadata`,
`user_metadata`, or JWT claims.

## Installed UI primitives

`button`, `input`, `label`, `card`, `dialog`, `dropdown-menu`, `select`,
`table`, `badge`, `tabs`.

See them all rendered together at `/showcase` (`src/app/showcase/page.tsx`)
when running the dev server.

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

## Deployment

Hosted on the Vercel project `forward-deployed`, owned by Samay Kapadia.

Pushes to `main` deploy to production. Every pull request gets a preview
deployment, with the URL posted as a comment on the PR.

Deployments run through `.github/workflows/vercel.yml` using the Vercel CLI,
authenticated with the GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
and `VERCEL_PROJECT_ID`.

To update environment variables, change them in the Vercel project settings,
then redeploy — either by re-running the latest `main` workflow run in the
Actions tab, or by pushing a new commit. Changes only apply to new
deployments.
