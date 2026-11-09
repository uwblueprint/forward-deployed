# Role model

Decided in FOR-21 and FOR-58. Describes what `supabase/migrations/` enforces.

## Roles and organizations

Each user has at most one membership (`public.memberships`): an organization
and a role, `admin`, `manager`, or `volunteer`. Nobody picks their own role or
organization at signup.

| Role | Can do, inside their own organization only |
| --- | --- |
| Admin | Everything a manager can, plus change roles, invite people, read the audit log, write internal notes on applications, and edit organization settings and custom fields |
| Manager | Review applications, edit volunteer profiles, manage events, registrations, and attendance |
| Volunteer | Their own profile, applications, and registrations; browse published events |

Manager permissions are a placeholder until the PRD defines them.

Memberships are read-only through the API. Admins change other users' roles with:

```ts
await supabase.rpc("set_user_role", { target_user_id: userId, new_role: "manager" })
```

Read the membership on the server per request, after `supabase.auth.getUser()`.
`null` means the user hasn't joined an organization yet.

```ts
const { data: membership } = await supabase
  .from("memberships")
  .select("organization_id, role")
  .eq("user_id", user.id)
  .maybeSingle()
```

Roles live in a table, not JWT claims or `app_metadata`, so a change applies on
the next request instead of after a token refresh. Route guards are UX only; the
database enforces access.

Volunteer profiles belong to an organization too, so a person's applications,
notes, and registrations stay with the organization they were made in. Someone
can fill in their profile before joining; it joins the organization with them,
as pending. They can't apply or register until then. A profile that already has
applications or registrations never moves to another organization.

One organization per user is enforced by the `memberships_one_org_per_user`
constraint. Allowing several means dropping it and replacing every
`current_org_id()` check, in the helpers and the policies, with a check against
the row's organization.

## Joining an organization

Admins invite people by email address and role:

```ts
const { data } = await supabase.rpc("create_invitation", { invitee_email, invitee_role: "volunteer" })
// data[0].token goes in the invite link. It's returned once; only its hash is stored.
```

The invitee signs up or signs in with that address, confirms it, and redeems the token:

```ts
const { data: organizationId } = await supabase.rpc("redeem_invitation", { invitation_token })
```

Invitations expire after 7 days and work once. Inviting the same address again
replaces the open invitation. Admins list their organization's invitations
from `invitations` and cancel one with `revoke_invitation`. An invitation also
stops working if the admin who issued it is demoted or removed. Redeeming
fails with a fixed message when the invitation is unknown, used, revoked, or
expired, is for another address, the address isn't confirmed, or the user
already belongs to an organization. Retrying after a success returns the same
organization.

The confirmed-address check only means something while email confirmation is
on in the hosted project (Authentication settings). Keep it on. Local dev has
it off, so local signups are confirmed automatically.

## First admin

Nobody can promote themselves and only admins can promote others, so the first
admin is created server-side. Have the person sign up, then run:

```bash
npm run db:bootstrap-admin -- --email person@example.com --org "Org name"
```

It creates the organization and makes them its admin, using the secret key in
`.env.local`. Their email must be confirmed. Re-running it is safe. The seed
does the same for its demo organizations.

## Types

`src/lib/supabase/database.types.ts` is generated from the local database.
After adding a migration, rebuild the database from the migrations, then
regenerate and commit the file. CI fails if it's out of date.

```bash
npx supabase db reset
npm run db:types
```

The clients in `src/lib/supabase/` pass `Database`, so queries and RPCs are
typed. `src/lib/adapters/types.ts` adds the user with their membership, the
volunteer and event columns the API lets you write, and the volunteer and
event repository contracts.

## Applications and volunteer status

A volunteer submits an application (`public.applications`). Staff approve or
reject it; the database records who reviewed it and when. `volunteers.status`
always mirrors the latest application.

| Status | Volunteer can |
| --- | --- |
| No profile | Create a profile and apply |
| `pending` | Edit their profile, browse published events |
| `approved` | Also register for open events |
| `rejected` | Same as pending, and reapply |

The applicant sees `applicant_message` as soon as it's saved. A rejection with
a blank message gets the organization's `default_rejection_message`, which
admins set. Approval clears the message.

Admin-only notes go in `application_notes`. That's a separate table because a
column grant can't hide a column from applicants: admins and applicants are
the same database role. Nobody reads or writes notes on their own application.

## Events and registrations

- An event is open while it's published, hasn't started, and is before its
  `registration_deadline`, if it has one.
- Capacity is checked after access rules, with the event row locked, so two
  people can't both take the last spot. It applies to staff and server-side
  writes too; raise the capacity to add more. A full event fails with
  `This event is full` (code 23514).
- "Full" and "closed" are derived, not stored. Read spots taken with
  `from("events").select("*, registration_count")`. It counts only events the
  caller can see and doesn't reveal who registered.
- Volunteers can cancel until attendance is recorded or the event is completed.
  They still see events they registered for after those are cancelled or
  completed. Drafts are staff-only.
- An event with any registrations, cancelled ones included, can't be deleted;
  cancel it instead, which keeps attendance history. Staff can delete a
  registration until attendance is recorded or the event is completed.
- Recorded attendance can be corrected but not cleared, and a completed event
  can't be reopened.
- Hours aren't stored. Derive them from `ends_at - starts_at` for attended
  registrations.

## Audit log

`audit_log` records application decisions, role changes (joining and leaving
included), invitations issued, revoked, and redeemed, and event status changes
(creation and deletion included), with who made each one and when. A null actor means a server-side change. Admins read
their organization's history. Nobody can change, delete, or truncate entries
through the API or with the secret key, and a trigger refuses it for the
database owner too, even in replica mode. Deleting a user or organization
leaves its history in place.

## Signup

A trigger creates the `public.users` row on signup, with the name from signup
metadata. It works without an email (e.g. phone signups). It never creates a
membership, and never reads role or organization from signup data. Until a
user joins an organization, they see only their own rows.

## Locked fields

- `users.email` mirrors `auth.users`; change it with `supabase.auth.updateUser({ email })`.
- Memberships change only through `set_user_role`, invitations, and server-side scripts.
- `volunteers.organization_id` comes from the owner's membership, or is filled in when they join, and never changes after that.
- `volunteers.status` changes only through applications.
- Only the volunteer records their consent; the database sets the time.
- Only staff record attendance.
- The database sets `applications.reviewed_by`, `reviewed_at`, and
  `application_notes.updated_by`.
- Ids, `user_id`, `event_id`, `volunteer_id`, and event `organization_id` never change after insert.

Tests: `supabase/tests/database/`.

## Known gaps

- The default rejection wording needs PM sign-off; the seed's is placeholder copy.
- No `registration_count` column yet. Add a trigger-maintained one if counting gets slow.
- No screens for invitations or the audit log yet.
