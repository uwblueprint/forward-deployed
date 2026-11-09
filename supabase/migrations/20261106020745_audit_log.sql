-- Append-only history of application decisions, role changes (joining and
-- leaving included), invitations, and event status changes, creation and
-- deletion included (FOR-67). Only record_audit writes it; admins read their
-- organization's. Ids are plain uuids, not foreign keys, so deleting a user or
-- organization can't rewrite or remove its history.

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  actor_id uuid, -- null for server-side changes
  action text not null check (action in ('application_status', 'role', 'invitation', 'event_status')),
  entity_id uuid not null, -- the application, the member's user id, the invitation, or the event
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index on public.audit_log (organization_id, created_at desc);
alter table public.audit_log enable row level security;

revoke all on table public.audit_log from anon, authenticated, service_role;
revoke all on sequence public.audit_log_id_seq from anon, authenticated, service_role;
grant select on table public.audit_log to authenticated, service_role;

create function private.forbid_audit_changes() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'The audit log is append-only' using errcode = '42501';
end;
$$;

create trigger forbid_audit_changes
  before update or delete on public.audit_log
  for each row execute function private.forbid_audit_changes();

create trigger forbid_audit_truncate
  before truncate on public.audit_log
  for each statement execute function private.forbid_audit_changes();

-- Fire even with session_replication_role = replica, which skips ordinary triggers.
alter table public.audit_log
  enable always trigger forbid_audit_changes,
  enable always trigger forbid_audit_truncate;

create function private.record_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_table_name = 'applications' then
    insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
    select organization_id, actor, 'application_status', new.id, old.status::text, new.status::text
    from public.volunteers where id = new.volunteer_id and organization_id is not null;
  elsif tg_table_name = 'events' then
    if tg_op = 'DELETE' then
      insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
      values (old.organization_id, actor, 'event_status', old.id, old.status::text, null);
    else
      insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
      values (new.organization_id, actor, 'event_status', new.id, case when tg_op = 'UPDATE' then old.status::text end, new.status::text);
    end if;
  elsif tg_table_name = 'invitations' then
    -- Issued: null to the invited role. Then the role to 'revoked' or 'redeemed'.
    insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
    values (new.organization_id, actor, 'invitation', new.id,
      case when tg_op = 'UPDATE' then new.role::text end,
      case when tg_op = 'INSERT' then new.role::text when new.redeemed_at is not null then 'redeemed' else 'revoked' end);
  elsif tg_op = 'UPDATE' and old.organization_id = new.organization_id then
    insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
    values (new.organization_id, actor, 'role', new.user_id, old.role::text, new.role::text);
  else
    -- A membership ending (deleted, or moved to another organization) ...
    if tg_op <> 'INSERT' then
      insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
      values (old.organization_id, actor, 'role', old.user_id, old.role::text, null);
    end if;
    -- ... and one starting (created, or moved in).
    if tg_op <> 'DELETE' then
      insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value)
      values (new.organization_id, actor, 'role', new.user_id, null, new.role::text);
    end if;
  end if;
  return null;
end;
$$;

create trigger record_audit
  after update of status on public.applications
  for each row when (old.status is distinct from new.status)
  execute function private.record_audit();

create trigger record_audit
  after insert or delete on public.events
  for each row execute function private.record_audit();

create trigger record_audit_on_update
  after update of status on public.events
  for each row when (old.status is distinct from new.status)
  execute function private.record_audit();

create trigger record_audit
  after insert on public.invitations
  for each row execute function private.record_audit();

create trigger record_audit_on_update
  after update of revoked_at, redeemed_at on public.invitations
  for each row when ((old.revoked_at is null and new.revoked_at is not null) or (old.redeemed_at is null and new.redeemed_at is not null))
  execute function private.record_audit();

create trigger record_audit
  after insert or delete on public.memberships
  for each row execute function private.record_audit();

create trigger record_audit_on_update
  after update of role, organization_id on public.memberships
  for each row when (old.role is distinct from new.role or old.organization_id <> new.organization_id)
  execute function private.record_audit();

-- Members who joined before this log existed.
insert into public.audit_log (organization_id, actor_id, action, entity_id, old_value, new_value, created_at)
select organization_id, null, 'role', user_id, null, role::text, created_at from public.memberships;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

create policy "audit_log: admins read own org"
  on public.audit_log for select to authenticated
  using ((select private.is_admin()) and organization_id = (select private.current_org_id()));
