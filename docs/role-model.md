# Role model

**Provisional (FOR-21).** Describes what `supabase/migrations/` enforces today.

## Roles

`public.users.role` is `admin`, `manager`, or `volunteer` (default). Each user
belongs to at most one organization (`users.organization_id`). Nobody picks
their own role at signup.

| Role | Can do, inside their own organization only |
| --- | --- |
| Admin | Everything a manager can, plus change roles, organization settings, and custom fields |
| Manager | Review applications, edit volunteer profiles, manage events, registrations, and attendance |
| Volunteer | Their own profile, applications, and registrations; browse published events |

Manager permissions are a placeholder until the PRD defines them.

The role column isn't writable directly. Admins change other users' roles with:

```ts
await supabase.rpc("set_user_role", { target_user_id: userId, new_role: "manager" })
```

Read the role on the server per request, after `supabase.auth.getUser()`:

```ts
const { data } = await supabase.from("users").select("role, organization_id").eq("id", user.id).single()
```

Roles live in a table, not JWT claims, so a change applies on the next request
instead of after a token refresh. Route guards are UX only; the database enforces access.

## Applications and volunteer status

A volunteer submits an application (`public.applications`). Staff approve or
reject it; the database records who reviewed it and when. `volunteers.status`
always mirrors the latest application.

| Status | Volunteer can |
| --- | --- |
| No profile | Create a profile and apply |
| `pending` | Edit their profile, browse published events |
| `approved` | Also register for published events that haven't started |
| `rejected` | Same as pending, and reapply |

Volunteers can cancel their own registrations until attendance is recorded or
the event is completed. They still see events they registered for after those
are cancelled or completed. Drafts are staff-only.

## Signup and organizations

A trigger creates the `public.users` row on signup: role `volunteer`, no
organization, name from signup metadata. Role and organization are never read
from signup data. Until assigned an organization, a user sees only their own
rows. *Open:* how volunteers get an organization.

## First admin

Nobody can promote themselves and only admins can promote others, so the first
admin must be created server-side. The seed does this in dev. For a new project,
have the person sign up, then run:

```bash
npx supabase db query --linked "insert into public.organizations (name) values ('Org name') returning id"
npx supabase db query --linked "update public.users set role = 'admin', organization_id = '<org id>' where email = '<their email>'"
```

Without this step, a project where the seed never runs has no admins.

## Locked fields

- `users.email` mirrors `auth.users`; change it with `supabase.auth.updateUser({ email })`.
- `users.role` changes only through `set_user_role`, by an admin, for someone else in their org.
- `users.organization_id` and `volunteers.status` change only server-side or via applications.
- Only the volunteer records their consent; the database sets the time.
- Only staff record attendance.
- Ids, `user_id`, `event_id`, `volunteer_id`, and event `organization_id` never change after insert.

Tests: `supabase/tests/database/access_control.test.sql`.

## Known gaps

- Event capacity is not enforced on registration.
- TypeScript types come after this schema merges (FOR-21).
