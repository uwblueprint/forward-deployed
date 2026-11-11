-- Memberships (FOR-58): each user's organization and role, one organization
-- per user (memberships_one_org_per_user). Volunteer profiles also belong to an
-- organization, so applications, notes, and registrations stay with the
-- organization they were made in. A profile made before joining has no
-- organization until its owner joins one.

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null default 'volunteer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_one_org_per_user unique (user_id)
);

create index on public.memberships (organization_id);

create trigger set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
alter table public.memberships enable row level security;

insert into public.memberships (user_id, organization_id, role)
select id, organization_id, role from public.users where organization_id is not null;

-- Read-only through the API. set_user_role and the invitation functions change it.
revoke all on table public.memberships from anon, authenticated;
grant select, insert, update, delete on table public.memberships to service_role;
grant select on table public.memberships to authenticated;

-- Filled in from the owner's membership (set_volunteer_organization below); the
-- insert grant leaves it out, so nobody picks it.
alter table public.volunteers
  add column organization_id uuid references public.organizations (id) on delete cascade,
  drop constraint volunteers_user_id_key,
  add unique nulls not distinct (user_id, organization_id);
create index on public.volunteers (organization_id);

update public.volunteers v set organization_id = m.organization_id
from public.memberships m where m.user_id = v.user_id;

-- A profile made before joining an organization joins with its owner, but
-- only if it was never used: one with applications or registrations stays
-- behind, so nothing reviewed elsewhere carries over. Both this and the insert
-- below lock the user's row, so a profile saved while they join isn't missed.
create function private.attach_volunteer_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.users where id = new.user_id for no key update;
  update public.volunteers v set organization_id = new.organization_id, status = 'pending'
  where v.user_id = new.user_id and v.organization_id is null
    and not exists (select 1 from public.applications where volunteer_id = v.id)
    and not exists (select 1 from public.registrations where volunteer_id = v.id)
    and not exists (select 1 from public.volunteers where user_id = new.user_id and organization_id = new.organization_id);
  return null;
end;
$$;

create trigger attach_volunteer_profile
  after insert on public.memberships
  for each row execute function private.attach_volunteer_profile();

create function private.set_volunteer_organization() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.organization_id is null then
    perform 1 from public.users where id = new.user_id for no key update;
    new.organization_id = (select organization_id from public.memberships where user_id = new.user_id);
  end if;
  return new;
end;
$$;

create trigger set_volunteer_organization
  before insert on public.volunteers
  for each row execute function private.set_volunteer_organization();

-------------------------------------------------------------------------------
-- Helpers and set_user_role, redefined over memberships with the same signatures.
-------------------------------------------------------------------------------

create or replace function private.current_org_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select organization_id from public.memberships where user_id = (select auth.uid()) $$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships where user_id = (select auth.uid()) and role = 'admin') $$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships where user_id = (select auth.uid()) and role in ('admin', 'manager')) $$;

create or replace function private.current_volunteer_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.volunteers where user_id = (select auth.uid()) and organization_id = (select private.current_org_id()) $$;

create or replace function private.is_approved_volunteer() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.volunteers where id = (select private.current_volunteer_id()) and status = 'approved') $$;

create or replace function private.my_org_user_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select user_id from public.memberships where organization_id = (select private.current_org_id()) $$;

create or replace function private.my_org_volunteer_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select id from public.volunteers where organization_id = (select private.current_org_id()) $$;

create or replace function public.set_user_role(target_user_id uuid, new_role public.app_role) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if target_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  -- Serializes role changes per organization, so two admins demoting each
  -- other at once can't leave it with none: the second sees it's no longer admin.
  perform 1 from public.memberships
  where organization_id = (select private.current_org_id()) and role = 'admin'
  order by user_id for update;
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  update public.memberships set role = new_role
  where user_id = target_user_id and organization_id = (select private.current_org_id());
  if not found then
    raise exception 'User not found in your organization' using errcode = '42501';
  end if;
end;
$$;

-------------------------------------------------------------------------------
-- Policies
-------------------------------------------------------------------------------

create policy "memberships: read own, staff read own org"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or ((select private.is_staff()) and organization_id = (select private.current_org_id())));

drop policy "users: read self, staff read own org" on public.users;
create policy "users: read self, staff read own org"
  on public.users for select to authenticated
  using (id = (select auth.uid()) or ((select private.is_staff()) and id in (select private.my_org_user_ids())));

drop policy "users: update self, staff update own org" on public.users;
create policy "users: update self, staff update own org"
  on public.users for update to authenticated
  using (id = (select auth.uid()) or ((select private.is_staff()) and id in (select private.my_org_user_ids())))
  with check (id = (select auth.uid()) or ((select private.is_staff()) and id in (select private.my_org_user_ids())));

-- A user's own profile is the one in their organization, or their unattached
-- one; profiles they left behind in another organization stay there.
drop policy "volunteers: read self, staff read own org" on public.volunteers;
create policy "volunteers: read self, staff read own org"
  on public.volunteers for select to authenticated
  using (
    (user_id = (select auth.uid()) and organization_id is not distinct from (select private.current_org_id()))
    or ((select private.is_staff()) and organization_id = (select private.current_org_id()))
  );

drop policy "volunteers: create own profile" on public.volunteers;
create policy "volunteers: create own profile"
  on public.volunteers for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id is not distinct from (select private.current_org_id()));

drop policy "volunteers: update self, staff update own org" on public.volunteers;
create policy "volunteers: update self, staff update own org"
  on public.volunteers for update to authenticated
  using (
    (user_id = (select auth.uid()) and organization_id is not distinct from (select private.current_org_id()))
    or ((select private.is_staff()) and organization_id = (select private.current_org_id()))
  )
  with check (
    (user_id = (select auth.uid()) and organization_id is not distinct from (select private.current_org_id()))
    or ((select private.is_staff()) and organization_id = (select private.current_org_id()))
  );

-- Roles live on memberships, which the API can't write, so users needs no role guard.
drop trigger guard_users_update on public.users;
drop function private.guard_users_update();

alter table public.users drop column organization_id, drop column role;
