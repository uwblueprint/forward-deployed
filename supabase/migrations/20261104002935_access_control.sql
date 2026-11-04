-- Access control for FOR-23: grants, helper functions, auth triggers, and RLS.
-- Provisional role model; see docs/role-model.md.
--
-- Summary
--   Logged out (anon): no access to anything.
--   Volunteer: own user row, own volunteer profile, published events in their
--     organization, own registrations (create/cancel only when approved).
--   Admin: everything inside their own organization, nothing outside it,
--     including editing volunteer profiles. Only the volunteer can record
--     their own consent, and nobody can change their own role or review status.

-------------------------------------------------------------------------------
-- 1. Grants
--
-- auto_expose_new_tables is off, so the Data API can only reach what is
-- granted here. Column lists on insert/update keep id, organization_id, email,
-- user_id, and created_at read-only for every signed-in user. Which side may
-- change role and review fields is enforced by the guard triggers in step 4.
-------------------------------------------------------------------------------

revoke all on table
  public.organizations, public.users, public.volunteers, public.events, public.registrations
  from anon, authenticated;

-- Server-only key (seed script). Bypasses RLS but still needs table grants.
grant select, insert, update, delete on table
  public.organizations, public.users, public.volunteers, public.events, public.registrations
  to service_role;

grant select on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;

grant select on table public.users to authenticated;
grant update (full_name, role) on table public.users to authenticated;

grant select on table public.volunteers to authenticated;
grant insert (
  user_id, phone, location, availability_days, shift_preference, skills,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  consent_accepted_at
) on table public.volunteers to authenticated;
grant update (
  phone, location, availability_days, shift_preference, skills,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  consent_accepted_at,
  status, rejection_reason, reviewed_at
) on table public.volunteers to authenticated;

grant select, delete on table public.events to authenticated;
grant insert (
  organization_id, status, title, description, category, location, starts_at, ends_at, capacity
) on table public.events to authenticated;
grant update (
  status, title, description, category, location, starts_at, ends_at, capacity
) on table public.events to authenticated;

grant select, delete on table public.registrations to authenticated;
grant insert (event_id, volunteer_id, status) on table public.registrations to authenticated;
grant update (status) on table public.registrations to authenticated;

-------------------------------------------------------------------------------
-- 2. Helper functions
--
-- security definer so policies can look up the caller without triggering RLS
-- on the same tables (which would recurse). Each one only answers questions
-- about the caller. Call them as (select public.fn()) in policies so Postgres
-- evaluates them once per statement instead of once per row.
-------------------------------------------------------------------------------

create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.users where id = (select auth.uid());
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.current_volunteer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.volunteers where user_id = (select auth.uid());
$$;

create function public.is_approved_volunteer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteers where user_id = (select auth.uid()) and status = 'approved'
  );
$$;

revoke execute on function
  public.current_org_id(), public.is_admin(), public.current_volunteer_id(), public.is_approved_volunteer()
  from public, anon;
grant execute on function
  public.current_org_id(), public.is_admin(), public.current_volunteer_id(), public.is_approved_volunteer()
  to authenticated, service_role;

-------------------------------------------------------------------------------
-- 3. Auth triggers
--
-- Every auth.users row gets a public.users row. Role always starts as
-- 'volunteer' and organization_id as null. Never read role or organization
-- from signup metadata: the client controls that metadata.
-- auth.users is the source of truth for email; public.users.email mirrors it.
-------------------------------------------------------------------------------

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_change();

revoke execute on function
  public.handle_new_auth_user(), public.handle_auth_user_email_change()
  from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 4. Guard triggers
--
-- Column grants apply to the whole authenticated role, so they cannot tell a
-- volunteer from an admin. These triggers enforce who may change which
-- columns. Trusted server roles (migrations, seed, auth triggers) skip them.
-------------------------------------------------------------------------------

create function public.guard_users_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if old.id = (select auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
  else
    if not (select public.is_admin()) then
      raise exception 'Only admins can update other users' using errcode = '42501';
    end if;
    if (to_jsonb(new) - array['role', 'full_name']) is distinct from (to_jsonb(old) - array['role', 'full_name']) then
      raise exception 'Admins can only change the name and role of other users' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_users_update
  before update on public.users
  for each row execute function public.guard_users_update();

create function public.guard_volunteers_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if old.user_id = (select auth.uid()) then
    if (new.status, new.rejection_reason, new.reviewed_at)
       is distinct from (old.status, old.rejection_reason, old.reviewed_at) then
      raise exception 'You cannot change your own review status' using errcode = '42501';
    end if;
  else
    if not (select public.is_admin()) then
      raise exception 'Only admins can update other volunteers' using errcode = '42501';
    end if;
    if new.consent_accepted_at is distinct from old.consent_accepted_at then
      raise exception 'Only the volunteer can record their own consent' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_volunteers_update
  before update on public.volunteers
  for each row execute function public.guard_volunteers_update();

revoke execute on function
  public.guard_users_update(), public.guard_volunteers_update()
  from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 5. Row Level Security policies
--
-- RLS is already enabled on every table (first migration). One policy per
-- table and command; each branch of an "or" is one side of the access table.
-- All policies are "to authenticated", so anon matches none of them.
-------------------------------------------------------------------------------

-- organizations ---------------------------------------------------------------

create policy "organizations: members read own"
  on public.organizations for select to authenticated
  using (id = (select public.current_org_id()));

create policy "organizations: admins update own"
  on public.organizations for update to authenticated
  using ((select public.is_admin()) and id = (select public.current_org_id()))
  with check ((select public.is_admin()) and id = (select public.current_org_id()));

-- users -----------------------------------------------------------------------

create policy "users: read self, admins read own org"
  on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_admin()) and organization_id = (select public.current_org_id()))
  );

create policy "users: update self, admins update own org"
  on public.users for update to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_admin()) and organization_id = (select public.current_org_id()))
  )
  with check (
    id = (select auth.uid())
    or ((select public.is_admin()) and organization_id = (select public.current_org_id()))
  );

-- volunteers ------------------------------------------------------------------

create policy "volunteers: read self, admins read own org"
  on public.volunteers for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.users u
        where u.id = volunteers.user_id
          and u.organization_id = (select public.current_org_id())
      )
    )
  );

create policy "volunteers: create own profile"
  on public.volunteers for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "volunteers: update self, admins update own org"
  on public.volunteers for update to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.users u
        where u.id = volunteers.user_id
          and u.organization_id = (select public.current_org_id())
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.users u
        where u.id = volunteers.user_id
          and u.organization_id = (select public.current_org_id())
      )
    )
  );

-- events ----------------------------------------------------------------------

create policy "events: volunteers read published, admins read all"
  on public.events for select to authenticated
  using (
    organization_id = (select public.current_org_id())
    and (status = 'published' or (select public.is_admin()))
  );

create policy "events: admins create in own org"
  on public.events for insert to authenticated
  with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));

create policy "events: admins update in own org"
  on public.events for update to authenticated
  using ((select public.is_admin()) and organization_id = (select public.current_org_id()))
  with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));

create policy "events: admins delete in own org"
  on public.events for delete to authenticated
  using ((select public.is_admin()) and organization_id = (select public.current_org_id()));

-- registrations ---------------------------------------------------------------

create policy "registrations: read own, admins read own org"
  on public.registrations for select to authenticated
  using (
    (
      registrations.volunteer_id = (select public.current_volunteer_id())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.organization_id = (select public.current_org_id())
      )
    )
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.organization_id = (select public.current_org_id())
      )
    )
  );

create policy "registrations: approved volunteers or admins create"
  on public.registrations for insert to authenticated
  with check (
    (
      registrations.volunteer_id = (select public.current_volunteer_id())
      and (select public.is_approved_volunteer())
      and registrations.status = 'registered'
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.status = 'published'
          and e.organization_id = (select public.current_org_id())
      )
    )
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.organization_id = (select public.current_org_id())
      )
      and exists (
        select 1 from public.volunteers v
        join public.users u on u.id = v.user_id
        where v.id = registrations.volunteer_id
          and u.organization_id = (select public.current_org_id())
      )
    )
  );

create policy "registrations: approved volunteers or admins update"
  on public.registrations for update to authenticated
  using (
    (
      registrations.volunteer_id = (select public.current_volunteer_id())
      and (select public.is_approved_volunteer())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.status = 'published'
          and e.organization_id = (select public.current_org_id())
      )
    )
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.organization_id = (select public.current_org_id())
      )
    )
  )
  with check (
    (
      registrations.volunteer_id = (select public.current_volunteer_id())
      and (select public.is_approved_volunteer())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.status = 'published'
          and e.organization_id = (select public.current_org_id())
      )
    )
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.organization_id = (select public.current_org_id())
      )
    )
  );

create policy "registrations: admins delete in own org"
  on public.registrations for delete to authenticated
  using (
    (select public.is_admin())
    and exists (
      select 1 from public.events e
      where e.id = registrations.event_id
        and e.organization_id = (select public.current_org_id())
    )
  );
