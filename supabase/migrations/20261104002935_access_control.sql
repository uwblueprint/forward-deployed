-- Access rules (FOR-23): grants, helpers, triggers, RLS policies.
-- Who can do what is summarized in docs/role-model.md.

-------------------------------------------------------------------------------
-- Grants. auto_expose_new_tables is off, so the API reaches only what is
-- granted here. anon gets nothing. Column lists lock ids, organization_id,
-- user_id, email, role, and volunteers.status for every signed-in user.
-- Roles change only through public.set_user_role().
-------------------------------------------------------------------------------

revoke all on table
  public.organizations, public.users, public.volunteers, public.applications,
  public.events, public.registrations, public.custom_fields
  from anon, authenticated;

grant select, insert, update, delete on table
  public.organizations, public.users, public.volunteers, public.applications,
  public.events, public.registrations, public.custom_fields
  to service_role;

grant select on table public.organizations to authenticated;
grant update (name, logo_url, primary_color, secondary_color, settings) on table public.organizations to authenticated;

grant select on table public.users to authenticated;
grant update (first_name, last_name) on table public.users to authenticated;

grant select on table public.volunteers to authenticated;
grant insert (
  user_id, phone, location, availability_days, shift_preference, skills,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, consent_accepted_at
) on table public.volunteers to authenticated;
grant update (
  phone, location, availability_days, shift_preference, skills,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, consent_accepted_at
) on table public.volunteers to authenticated;

grant select on table public.applications to authenticated;
grant insert (volunteer_id, responses) on table public.applications to authenticated;
grant update (status, rejection_reason) on table public.applications to authenticated;

grant select, delete on table public.events to authenticated;
grant insert (
  organization_id, status, title, description, category, location, requirements, starts_at, ends_at, capacity
) on table public.events to authenticated;
grant update (
  status, title, description, category, location, requirements, starts_at, ends_at, capacity
) on table public.events to authenticated;

grant select, delete on table public.registrations to authenticated;
grant insert (event_id, volunteer_id, status, custom_responses) on table public.registrations to authenticated;
grant update (status, attendance_status, custom_responses) on table public.registrations to authenticated;

grant select, delete on table public.custom_fields to authenticated;
grant insert (organization_id, entity_type, field_name, field_type, required, options, position)
  on table public.custom_fields to authenticated;
grant update (entity_type, field_name, field_type, required, options, position)
  on table public.custom_fields to authenticated;

-------------------------------------------------------------------------------
-- Helpers. In the private schema so they are not API endpoints. security
-- definer so policies can look things up without recursive RLS. Each one only
-- answers questions about the caller.
-------------------------------------------------------------------------------

grant usage on schema private to authenticated, service_role;

create function private.current_org_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select organization_id from public.users where id = (select auth.uid()) $$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin') $$;

-- Staff = admins and managers. Managers run volunteers, applications, events,
-- and registrations; only admins change roles, organization settings, and custom fields.
create function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.users where id = (select auth.uid()) and role in ('admin', 'manager')) $$;

create function private.current_volunteer_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.volunteers where user_id = (select auth.uid()) $$;

create function private.is_approved_volunteer() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.volunteers where user_id = (select auth.uid()) and status = 'approved') $$;

-- The event's status if it belongs to the caller's organization, otherwise null.
create function private.my_org_event_status(target_event_id uuid) returns public.event_status
language sql stable security definer set search_path = ''
as $$ select status from public.events where id = target_event_id and organization_id = (select private.current_org_id()) $$;

-- Published, not yet started, and in the caller's organization.
create function private.is_open_event(target_event_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = target_event_id and status = 'published' and starts_at > now()
      and organization_id = (select private.current_org_id())
  )
$$;

-- Set-returning helpers. Policies use them as "x in (select ...)", which
-- Postgres evaluates once per query instead of once per row.
create function private.my_org_user_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select id from public.users where organization_id = (select private.current_org_id()) $$;

create function private.my_org_volunteer_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select v.id from public.volunteers v
  join public.users u on u.id = v.user_id
  where u.organization_id = (select private.current_org_id())
$$;

create function private.my_org_event_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select id from public.events where organization_id = (select private.current_org_id()) $$;

create function private.my_registered_event_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select event_id from public.registrations where volunteer_id = (select private.current_volunteer_id()) $$;

-- Migrations, the seed, and auth triggers skip the user-facing checks below.
create function private.is_trusted_role() returns boolean
language sql stable set search_path = ''
as $$ select current_user in ('postgres', 'service_role', 'supabase_admin') $$;

-------------------------------------------------------------------------------
-- Triggers
-------------------------------------------------------------------------------

-- New auth account -> public.users row. Role and organization are never read
-- from signup metadata, because the browser controls it.
create function private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  full_name text := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
begin
  insert into public.users (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(full_name, ' ', 1)), ''),
    nullif(coalesce(meta ->> 'last_name', meta ->> 'family_name', trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1))), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function private.handle_auth_user_email_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_auth_user_email_change();

create function private.guard_users_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.is_trusted_role()) then
    return new;
  end if;
  if new.role is distinct from old.role then
    if old.id = (select auth.uid()) then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    if not (select private.is_admin()) then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_users_update
  before update on public.users
  for each row execute function private.guard_users_update();

-- Only the volunteer gives or withdraws consent, and the database sets the time.
-- A re-sent timestamp (e.g. a whole profile saved back) keeps the original.
create function private.guard_volunteer_consent() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.is_trusted_role()) then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.consent_accepted_at is null) = (old.consent_accepted_at is null) then
    new.consent_accepted_at = old.consent_accepted_at;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.user_id <> (select auth.uid()) then
    raise exception 'Only the volunteer can record their own consent' using errcode = '42501';
  end if;
  if new.consent_accepted_at is not null then
    new.consent_accepted_at = now();
  end if;
  return new;
end;
$$;

create trigger guard_volunteer_consent
  before insert or update on public.volunteers
  for each row execute function private.guard_volunteer_consent();

-- Reviews are stamped by the database; nobody reviews their own application.
create function private.review_application() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.is_trusted_role()) then
    return new;
  end if;
  if exists (select 1 from public.volunteers where id = old.volunteer_id and user_id = (select auth.uid())) then
    raise exception 'You cannot review your own application' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.reviewed_by = (select auth.uid());
    new.reviewed_at = now();
  end if;
  if new.status = 'approved' then
    new.rejection_reason = null;
  end if;
  return new;
end;
$$;

create trigger review_application
  before update on public.applications
  for each row execute function private.review_application();

-- volunteers.status always equals the latest application's status.
create function private.sync_volunteer_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid := coalesce(new.volunteer_id, old.volunteer_id);
  latest public.volunteer_status;
begin
  select status into latest from public.applications
  where volunteer_id = target
  order by submitted_at desc, id desc
  limit 1;
  update public.volunteers set status = coalesce(latest, 'pending')
  where id = target and status is distinct from coalesce(latest, 'pending');
  return null;
end;
$$;

create trigger sync_volunteer_status
  after insert or delete or update of status, submitted_at on public.applications
  for each row execute function private.sync_volunteer_status();

-- Volunteers can only register or cancel; attendance and answers are staff edits.
create function private.guard_registrations_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.is_trusted_role()) or (select private.is_staff()) then
    return new;
  end if;
  if (new.attendance_status, new.custom_responses) is distinct from (old.attendance_status, old.custom_responses) then
    raise exception 'Volunteers can only change the status of their registration' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_registrations_update
  before update on public.registrations
  for each row execute function private.guard_registrations_update();

-- The only way to change a role: admins, for other users in their organization.
-- Exposed as an API call: supabase.rpc("set_user_role", { target_user_id, new_role }).
create function public.set_user_role(target_user_id uuid, new_role public.app_role) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if target_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  update public.users set role = new_role
  where id = target_user_id and organization_id = (select private.current_org_id());
  if not found then
    raise exception 'User not found in your organization' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-------------------------------------------------------------------------------
-- RLS policies. One per table and command, all "to authenticated", so anon
-- matches none. Nobody sees anything outside their own organization.
-------------------------------------------------------------------------------

create policy "organizations: members read own"
  on public.organizations for select to authenticated
  using (id = (select private.current_org_id()));

create policy "organizations: admins update own"
  on public.organizations for update to authenticated
  using ((select private.is_admin()) and id = (select private.current_org_id()))
  with check ((select private.is_admin()) and id = (select private.current_org_id()));

create policy "users: read self, staff read own org"
  on public.users for select to authenticated
  using (id = (select auth.uid()) or ((select private.is_staff()) and organization_id = (select private.current_org_id())));

create policy "users: update self, staff update own org"
  on public.users for update to authenticated
  using (id = (select auth.uid()) or ((select private.is_staff()) and organization_id = (select private.current_org_id())))
  with check (id = (select auth.uid()) or ((select private.is_staff()) and organization_id = (select private.current_org_id())));

create policy "volunteers: read self, staff read own org"
  on public.volunteers for select to authenticated
  using (user_id = (select auth.uid()) or ((select private.is_staff()) and user_id in (select private.my_org_user_ids())));

create policy "volunteers: create own profile"
  on public.volunteers for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "volunteers: update self, staff update own org"
  on public.volunteers for update to authenticated
  using (user_id = (select auth.uid()) or ((select private.is_staff()) and user_id in (select private.my_org_user_ids())))
  with check (user_id = (select auth.uid()) or ((select private.is_staff()) and user_id in (select private.my_org_user_ids())));

create policy "applications: read own, staff read own org"
  on public.applications for select to authenticated
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and volunteer_id in (select private.my_org_volunteer_ids())));

-- Apply, or reapply after a rejection. The unique index blocks a second open application.
create policy "applications: volunteers apply"
  on public.applications for insert to authenticated
  with check (volunteer_id = (select private.current_volunteer_id()) and not (select private.is_approved_volunteer()));

create policy "applications: staff review own org"
  on public.applications for update to authenticated
  using (
    (select private.is_staff()) and volunteer_id in (select private.my_org_volunteer_ids())
    and volunteer_id is distinct from (select private.current_volunteer_id())
  )
  with check (
    (select private.is_staff()) and volunteer_id in (select private.my_org_volunteer_ids())
    and volunteer_id is distinct from (select private.current_volunteer_id())
  );

-- Volunteers see published events, plus non-draft events they registered for (their history).
create policy "events: read published or registered, staff read all"
  on public.events for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (status = 'published' or (select private.is_staff()) or (status <> 'draft' and id in (select private.my_registered_event_ids())))
  );

create policy "events: staff create in own org"
  on public.events for insert to authenticated
  with check ((select private.is_staff()) and organization_id = (select private.current_org_id()));

create policy "events: staff update in own org"
  on public.events for update to authenticated
  using ((select private.is_staff()) and organization_id = (select private.current_org_id()))
  with check ((select private.is_staff()) and organization_id = (select private.current_org_id()));

create policy "events: staff delete in own org"
  on public.events for delete to authenticated
  using ((select private.is_staff()) and organization_id = (select private.current_org_id()));

create policy "registrations: read own, staff read own org"
  on public.registrations for select to authenticated
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and event_id in (select private.my_org_event_ids())));

-- Approved volunteers register for open events; staff register anyone in their org.
create policy "registrations: approved volunteers or staff create"
  on public.registrations for insert to authenticated
  with check (
    (
      volunteer_id = (select private.current_volunteer_id())
      and (select private.is_approved_volunteer())
      and status = 'registered'
      and private.is_open_event(event_id)
    )
    or (
      (select private.is_staff())
      and event_id in (select private.my_org_event_ids())
      and volunteer_id in (select private.my_org_volunteer_ids())
    )
  );

-- Volunteers can cancel until attendance is recorded or the event is completed.
-- Re-registering needs approval and an open event.
create policy "registrations: volunteers cancel or re-register, staff manage"
  on public.registrations for update to authenticated
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and event_id in (select private.my_org_event_ids())))
  with check (
    (
      volunteer_id = (select private.current_volunteer_id())
      and (
        (status = 'cancelled' and attendance_status is null and private.my_org_event_status(event_id) is distinct from 'completed')
        or (attendance_status is null and (select private.is_approved_volunteer()) and private.is_open_event(event_id))
      )
    )
    or ((select private.is_staff()) and event_id in (select private.my_org_event_ids()))
  );

create policy "registrations: staff delete in own org"
  on public.registrations for delete to authenticated
  using ((select private.is_staff()) and event_id in (select private.my_org_event_ids()));

create policy "custom_fields: members read own org"
  on public.custom_fields for select to authenticated
  using (organization_id = (select private.current_org_id()));

create policy "custom_fields: admins create in own org"
  on public.custom_fields for insert to authenticated
  with check ((select private.is_admin()) and organization_id = (select private.current_org_id()));

create policy "custom_fields: admins update in own org"
  on public.custom_fields for update to authenticated
  using ((select private.is_admin()) and organization_id = (select private.current_org_id()))
  with check ((select private.is_admin()) and organization_id = (select private.current_org_id()));

create policy "custom_fields: admins delete in own org"
  on public.custom_fields for delete to authenticated
  using ((select private.is_admin()) and organization_id = (select private.current_org_id()));
