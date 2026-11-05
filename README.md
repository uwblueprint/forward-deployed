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
| Vercel | TBD | TBD |

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
managers, and 10 volunteers. All logins share `SEED_USER_PASSWORD`, or a random
password printed at the end. Re-running replaces only the seed's own rows.
Needs Node 22.18 or newer.

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
