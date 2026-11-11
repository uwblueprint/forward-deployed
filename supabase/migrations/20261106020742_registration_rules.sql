-- Registration rules (FOR-58). "Full" and "closed" are derived from capacity
-- and registration_deadline, never stored.

alter table public.events
  add column registration_deadline timestamptz,
  add check (registration_deadline <= starts_at);

grant insert (registration_deadline), update (registration_deadline) on table public.events to authenticated;

-- Published, not yet started, before any registration deadline, and in the caller's organization.
create or replace function private.is_open_event(target_event_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = target_event_id and status = 'published' and starts_at > now()
      and (registration_deadline is null or registration_deadline > now())
      and organization_id = (select private.current_org_id())
  )
$$;

-- Runs after RLS accepts the row, with the event row locked, so two people
-- can't both take the last spot. Applies to everyone, staff and server-side
-- writes included. security definer because callers can't see other people's
-- registrations. The lock only works at read committed (the API's level): at
-- stricter levels the count would come from a snapshot taken before the wait.
create function private.enforce_event_capacity() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  spots integer;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Register at read committed isolation so capacity can be checked';
  end if;
  select capacity into spots from public.events where id = new.event_id for no key update;
  if (select count(*) from public.registrations where event_id = new.event_id and status = 'registered') > spots then
    raise exception 'This event is full' using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger enforce_event_capacity
  after insert on public.registrations
  for each row when (new.status = 'registered')
  execute function private.enforce_event_capacity();

create trigger enforce_event_capacity_on_update
  after update of status, event_id on public.registrations
  for each row when (new.status = 'registered' and (old.status <> 'registered' or old.event_id <> new.event_id))
  execute function private.enforce_event_capacity();

-- Counts across everyone's registrations, for the caller's organization only.
create function private.registered_count(target_event_id uuid) returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.registrations
  where event_id = target_event_id and status = 'registered'
    and ((select auth.uid()) is null or target_event_id in (select private.my_org_event_ids()))
$$;

-- Spots taken, selectable like a column: from("events").select("*, registration_count").
-- Runs as the caller, so it answers only for events they can see (null otherwise)
-- and doesn't reveal who registered.
create function public.registration_count(public.events) returns integer
language sql stable set search_path = ''
as $$ select private.registered_count(e.id) from public.events e where e.id = $1.id $$;

revoke execute on function public.registration_count(public.events) from public, anon;
grant execute on function public.registration_count(public.events) to authenticated, service_role;

-- Deleting an event would take its registrations and attendance history with
-- it, so it's refused while any exist; cancel the event instead. Deleting the
-- whole organization still removes everything. The row is locked before this
-- runs, so a registration committed meanwhile is seen.
create function private.guard_event_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.registrations where event_id = old.id)
    and exists (select 1 from public.organizations where id = old.organization_id) then
    raise exception 'This event has registrations; cancel it instead' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger guard_event_delete
  before delete on public.events
  for each row execute function private.guard_event_delete();

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Volunteers can only register or cancel; attendance and answers are staff
-- edits. Recorded attendance can be corrected but not cleared.
create or replace function private.guard_registrations_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.is_trusted_role()) then
    return new;
  end if;
  if old.attendance_status is not null and new.attendance_status is null then
    raise exception 'Recorded attendance can be corrected but not cleared' using errcode = '42501';
  end if;
  if (select private.is_staff()) then
    return new;
  end if;
  if (new.attendance_status, new.custom_responses) is distinct from (old.attendance_status, old.custom_responses) then
    raise exception 'Volunteers can only change the status of their registration' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- A completed event stays completed, so its registrations stay protected below.
create function private.guard_event_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'completed' and new.status <> 'completed' and not (select private.is_trusted_role()) then
    raise exception 'A completed event cannot be reopened' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_event_status
  before update of status on public.events
  for each row execute function private.guard_event_status();

-- Volunteers can cancel until attendance is recorded or the event is completed,
-- and re-register while approved and the event is open. An event outside their
-- organization counts as completed, since my_org_event_status returns null for it.
drop policy "registrations: volunteers cancel or re-register, staff manage" on public.registrations;
create policy "registrations: volunteers cancel or re-register, staff manage"
  on public.registrations for update to authenticated
  using (volunteer_id = (select private.current_volunteer_id()) or ((select private.is_staff()) and event_id in (select private.my_org_event_ids())))
  with check (
    (
      volunteer_id = (select private.current_volunteer_id())
      and (
        (status = 'cancelled' and attendance_status is null and coalesce(private.my_org_event_status(event_id), 'completed') <> 'completed')
        or (attendance_status is null and (select private.is_approved_volunteer()) and private.is_open_event(event_id))
      )
    )
    or ((select private.is_staff()) and event_id in (select private.my_org_event_ids()))
  );

-- Staff can remove a registration until attendance is recorded or the event is completed.
drop policy "registrations: staff delete in own org" on public.registrations;
create policy "registrations: staff delete in own org"
  on public.registrations for delete to authenticated
  using (
    (select private.is_staff()) and event_id in (select private.my_org_event_ids())
    and attendance_status is null and coalesce(private.my_org_event_status(event_id), 'completed') <> 'completed'
  );
