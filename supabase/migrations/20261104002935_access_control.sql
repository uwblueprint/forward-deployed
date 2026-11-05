-- Access rules (FOR-23): grants, helpers, triggers, RLS policies.
-- Who can do what is summarized in docs/role-model.md.

-------------------------------------------------------------------------------
-- Grants. auto_expose_new_tables is off, so the API reaches only what is
-- granted here. anon gets nothing. Column lists lock ids, organization_id,
-- user_id, email, and volunteers.status for every signed-in user.
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
grant update (first_name, last_name, role) on table public.users to authenticated;

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
as $$
  select e.status from public.events e
  join public.users u on u.organization_id = e.organization_id
  where e.id = target_event_id and u.id = (select auth.uid())
$$;

create function private.my_org_has_user(target_user_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users target
    join public.users me on me.organization_id = target.organization_id
    where target.id = target_user_id and me.id = (select auth.uid())
  )
$$;

create function private.my_org_has_volunteer(target_volunteer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.volunteers v
    where v.id = target_volunteer_id and private.my_org_has_user(v.user_id)
  )
$$;

create function private.is_registered_for(target_event_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.registrations r
    join public.volunteers v on v.id = r.volunteer_id
    where r.event_id = target_event_id and v.user_id = (select auth.uid())
  )
$$;

-------------------------------------------------------------------------------
-- Triggers. Trusted server roles (migrations, seed, auth triggers) skip the
-- checks below; signed-in users do not.
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
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
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

-- Only the volunteer records their own consent, and the database sets the time.
create function private.guard_volunteer_consent() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.consent_accepted_at is distinct from old.consent_accepted_at
     and old.user_id <> (select auth.uid()) then
    raise exception 'Only the volunteer can record their own consent' using errcode = '42501';
  end if;
  if new.consent_accepted_at is not null
     and (tg_op = 'INSERT' or new.consent_accepted_at is distinct from old.consent_accepted_at) then
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
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
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
begin
  -- The row just written wins unless a strictly newer application exists.
  update public.volunteers
  set status = new.status
  where id = new.volunteer_id
    and status is distinct from new.status
    and not exists (
      select 1 from public.applications a
      where a.volunteer_id = new.volunteer_id and a.id <> new.id and a.submitted_at > new.submitted_at
    );
  return new;
end;
$$;

create trigger sync_volunteer_status
  after insert or update of status on public.applications
  for each row execute function private.sync_volunteer_status();

-- Volunteers can only register or cancel; attendance and answers are staff edits.
create function private.guard_registrations_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or (select private.is_staff()) then
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
  using (user_id = (select auth.uid()) or ((select private.is_staff()) and private.my_org_has_user(user_id)));

create policy "volunteers: create own profile"
  on public.volunteers for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "volunteers: update self, staff update own org"
  on public.volunteers for update to authenticated
  using (user_id = (select auth.uid()) or ((select private.is_staff()) and private.my_org_has_user(user_id)))
  with check (user_id = (select auth.uid()) or ((select private.is_staff()) and private.my_org_has_user(user_id)));

create policy "applications: read own, staff read own org"
  on public.applications for select to authenticated
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and private.my_org_has_volunteer(volunteer_id)));

-- Apply, or reapply after a rejection. The unique index blocks a second open application.
create policy "applications: volunteers apply"
  on public.applications for insert to authenticated
  with check (volunteer_id = (select private.current_volunteer_id()) and not (select private.is_approved_volunteer()));

create policy "applications: staff review own org"
  on public.applications for update to authenticated
  using ((select private.is_staff()) and private.my_org_has_volunteer(volunteer_id))
  with check ((select private.is_staff()) and private.my_org_has_volunteer(volunteer_id));

-- Volunteers see published events, plus non-draft events they registered for (their history).
create policy "events: read published or registered, staff read all"
  on public.events for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (status = 'published' or (select private.is_staff()) or (status <> 'draft' and private.is_registered_for(id)))
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
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and private.my_org_event_status(event_id) is not null));

create policy "registrations: approved volunteers or staff create"
  on public.registrations for insert to authenticated
  with check (
    (
      volunteer_id = (select private.current_volunteer_id())
      and (select private.is_approved_volunteer())
      and status = 'registered'
      and private.my_org_event_status(event_id) = 'published'
    )
    or (
      (select private.is_staff())
      and private.my_org_event_status(event_id) is not null
      and private.my_org_has_volunteer(volunteer_id)
    )
  );

-- Volunteers can always cancel their own registration; re-registering needs
-- approval and a published event.
create policy "registrations: volunteers cancel or re-register, staff manage"
  on public.registrations for update to authenticated
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and private.my_org_event_status(event_id) is not null))
  with check (
    (
      volunteer_id = (select private.current_volunteer_id())
      and (status = 'cancelled' or ((select private.is_approved_volunteer()) and private.my_org_event_status(event_id) = 'published'))
    )
    or ((select private.is_staff()) and private.my_org_event_status(event_id) is not null)
  );

create policy "registrations: staff delete in own org"
  on public.registrations for delete to authenticated
  using ((select private.is_staff()) and private.my_org_event_status(event_id) is not null);

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
