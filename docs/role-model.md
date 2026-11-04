# Role model

**Status: provisional draft (FOR-21).** It describes what the migrations in
`supabase/migrations/` enforce today. Parts marked *open* are waiting on product
decisions.

## Roles

Every signed-in person has one row in `public.users`. Its `role` column is
`admin` or `volunteer` and defaults to `volunteer`. Each user belongs to at most
one organization, stored in `users.organization_id`.

Role decides which side of the app someone sees. Admins go to
`/admin/dashboard` and volunteers go to `/dashboard`. Nobody picks their own
role, so there is no role selection step at signup.

### Reading the role on the server

Verify the session first, then look the role up in the database:

```ts
const supabase = await createServerSupabaseClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect("/login")

const { data: profile } = await supabase
  .from("users")
  .select("role, organization_id")
  .eq("id", user.id)
  .single()
```

Use `getUser()`, not `getSession()`, for anything that grants access. Read the
role on each request instead of caching it in a cookie.

### Why not JWT claims or `app_metadata`

A role stored in the access token is copied in at sign-in and stays stale until
the token refreshes, which can take up to an hour. A demoted admin would keep
admin access until then. Keeping the role in a table means a change applies on
the very next request, and the database policies read the same value the app
does.

Route guards in the app are only for user experience. The real enforcement is
in the database, so a bug in a page cannot leak data.

## Volunteer status

A volunteer profile lives in `public.volunteers` and has a `status`, which is
separate from the role.

| Status | What the volunteer can do |
| --- | --- |
| No profile yet | Read their own user row and create their profile (onboarding). |
| `pending` | Edit their own profile and browse published events in their organization. Cannot register. |
| `approved` | Everything above, plus register for and cancel registrations on published events in their organization. |
| `rejected` | Same as `pending`. Whether they can reapply is *open*. |

Only an admin in the same organization can change `status`,
`rejection_reason`, and `reviewed_at`. Nobody can review their own profile.

## How users are created and get an organization

*Provisional.*

1. A person signs up with email or Google.
2. A database trigger creates their `public.users` row with role `volunteer`,
   no organization, and their name if Google provides one.
3. Role and organization are never taken from signup data, because the browser
   controls that data.
4. Until they have an organization, a user sees only their own rows. They see
   no events, and no admin can see them.

Today organizations and admins are assigned only by the seed script or by
someone using the secret key on the server. Admins cannot move users between
organizations. *Open:* how a new volunteer gets an organization, how the first
admin is created, and how admins invite other admins.

## Who can change which columns

| Column | Who can change it |
| --- | --- |
| `users.full_name` | The user themselves, or an admin in the same organization |
| `users.role` | An admin in the same organization, for other users only |
| `users.organization_id` | Server only (secret key) |
| `users.email` | Nobody directly; see the email rule below |
| `volunteers` profile fields | The volunteer themselves, or an admin in the same organization |
| `volunteers.consent_accepted_at` | The volunteer themselves only |
| `volunteers.status`, `rejection_reason`, `reviewed_at` | An admin in the same organization |
| `organizations.name` | Admins of that organization |
| `events` fields except `organization_id` | Admins of that organization |
| `registrations.status` | The approved volunteer for their own registration, or an admin of the event's organization |
| Every `id`, `created_at`, `user_id`, `organization_id`, `event_id`, `volunteer_id` | Set once on insert, never changed |

Three layers enforce this:

- Column-level grants decide which columns any signed-in user may write.
- Row Level Security policies decide which rows they may read or write.
- Guard triggers decide whether the volunteer side or the admin side may change role and review columns.

The tests in `supabase/tests/database/access_control.test.sql` check each rule.

## Email rule

`auth.users` is the source of truth for email. `public.users.email` is a copy
that a trigger keeps in sync. To change an email, call
`supabase.auth.updateUser({ email })`, which goes through Supabase Auth's
confirmation flow. Never write `public.users.email` directly. The onboarding
form should show the signed-in email as read-only rather than collect it.

## Known gaps

- Volunteers can read only `published` events. Event history will need them to
  see completed events they registered for.
- Event capacity is not enforced when registering.
- Generated TypeScript types come after the schema lands (FOR-21).
