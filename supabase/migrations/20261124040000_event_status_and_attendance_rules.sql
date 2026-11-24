-- Event status, attendance, and staff changes to signups (decided with the
-- tech lead, 2026-11-24). The app already checks the first two for friendlier
-- messages; the database now holds the rules, since the API can be called
-- directly.
--
-- Errors: 55000 when a change isn't allowed in the row's current state.

-------------------------------------------------------------------------------
-- Event status
-------------------------------------------------------------------------------

-- The same table as EVENT_TRANSITIONS in src/features/events/utils/eventState.ts:
--   draft     -> published, cancelled
--   published -> draft, cancelled, completed
--   cancelled and completed are final
-- Publish only before the start, complete only once it has started, and back
-- to draft only if nobody has ever signed up (a cancelled signup counts).
-- The event row is locked by the update, and registering locks it too, so a
-- signup can't slip in while an event goes back to draft.
-- Runs as the caller, like the other guards: is_trusted_role reads current_user,
-- so a security definer guard would count everyone as trusted and check nothing.
create or replace function private.guard_event_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = old.status or (select private.is_trusted_role()) then
    return new;
  end if;
  if old.status in ('cancelled', 'completed') then
    raise exception 'A % event cannot change status', old.status using errcode = '55000';
  end if;
  if old.status = 'draft' and new.status not in ('published', 'cancelled') then
    raise exception 'A draft event cannot be moved to %', new.status using errcode = '55000';
  end if;
  if new.status = 'published' and new.starts_at <= now() then
    raise exception 'An event that has already started cannot be published' using errcode = '55000';
  end if;
  if new.status = 'completed' and new.starts_at > now() then
    raise exception 'An event cannot be completed before it starts' using errcode = '55000';
  end if;
  if new.status = 'draft' and exists (select 1 from public.registrations where event_id = new.id) then
    raise exception 'An event with registrations cannot go back to draft; cancel it instead' using errcode = '55000';
  end if;
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- Attendance
-------------------------------------------------------------------------------

-- A cancelled signup never has attendance, so it never counts toward hours.
alter table public.registrations
  add constraint registrations_no_attendance_when_cancelled
  check (status <> 'cancelled' or attendance_status is null);

-- Volunteers can only register or cancel; attendance and answers are staff
-- edits. Attendance is recorded only for someone still registered, and only
-- once the event has started. Recorded attendance can be corrected but not
-- cleared, and a signup with attendance can't be cancelled afterwards.
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
  if not coalesce((select private.is_staff()), false) then
    if (new.attendance_status, new.custom_responses) is distinct from (old.attendance_status, old.custom_responses) then
      raise exception 'Volunteers can only change the status of their registration' using errcode = '42501';
    end if;
    -- The update policy decides the rest for volunteers, as before.
    return new;
  end if;
  if new.attendance_status is not null and new.status = 'cancelled' then
    raise exception 'A cancelled registration cannot have attendance' using errcode = '55000';
  end if;
  if new.attendance_status is distinct from old.attendance_status
    and exists (select 1 from public.events where id = new.event_id and starts_at > now()) then
    raise exception 'Attendance cannot be recorded before the event starts' using errcode = '55000';
  end if;
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- Audit: someone else changing a volunteer's signup
-------------------------------------------------------------------------------

-- Volunteers call or text a coordinator to drop out, so staff cancel (or
-- restore) signups for them. Those changes are logged with who made them.
-- A volunteer changing their own signup isn't logged.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('application_status', 'role', 'invitation', 'event_status', 'registration_status'));

-- entity_id is the registration; old_value and new_value are its status.
create function private.record_registration_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is not distinct from (select user_id from public.volunteers where id = new.volunteer_id) then
    return null;
  end if;
  insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
  select organization_id, actor, 'registration_status', new.id, old.status::text, new.status::text
  from public.events where id = new.event_id;
  return null;
end;
$$;

create trigger record_audit_on_update
  after update of status on public.registrations
  for each row when (old.status is distinct from new.status)
  execute function private.record_registration_audit();

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
