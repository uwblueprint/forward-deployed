<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Import rules

Import a feature only through its barrel, never by reaching into its internals:

```ts
import { VolunteerTable } from "@/features/volunteers"   // yes
import { VolunteerTable } from "@/features/volunteers/components/volunteer-table" // no
```

Anything not exported from a feature's `index.ts` is private to that feature.
Code shared across two or more features belongs in `src/components/common` or
`src/lib` instead.

See `README.md` for the full stack, project layout, and installed UI primitives.
