-- Rejection messaging (FOR-58). applicant_message is shown to the applicant.
-- Admin-only notes live in application_notes, a separate table, because a
-- column grant can't hide a column from applicants: admins and applicants are
-- both the authenticated database role.

alter table public.applications rename column rejection_reason to applicant_message;

alter table public.organizations add column default_rejection_message text;
grant update (default_rejection_message) on table public.organizations to authenticated;

-- Reviews are stamped by the database; nobody reviews their own application.
-- A rejection with a blank message gets the organization's default.
create or replace function private.review_application() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'approved' then
    new.applicant_message = null;
  elsif new.status = 'rejected' and nullif(btrim(new.applicant_message), '') is null then
    new.applicant_message = (
      select o.default_rejection_message
      from public.volunteers v join public.organizations o on o.id = v.organization_id
      where v.id = new.volunteer_id
    );
  end if;
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
  return new;
end;
$$;

create table public.application_notes (
  application_id uuid primary key references public.applications (id) on delete cascade,
  internal_note text not null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.application_notes (updated_by);

create trigger set_updated_at before update on public.application_notes
  for each row execute function private.set_updated_at();
alter table public.application_notes enable row level security;

revoke all on table public.application_notes from anon, authenticated;
grant select, insert, update, delete on table public.application_notes to service_role;
grant select, delete on table public.application_notes to authenticated;
grant insert (application_id, internal_note) on table public.application_notes to authenticated;
grant update (internal_note) on table public.application_notes to authenticated;

create function private.stamp_application_note() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not (select private.is_trusted_role()) then
    new.updated_by = (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger stamp_application_note
  before insert or update on public.application_notes
  for each row execute function private.stamp_application_note();

-- Applications whose notes the caller manages: admins only, in their
-- organization, and never their own application.
create function private.my_admin_application_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.applications
  where (select private.is_admin())
    and volunteer_id in (select private.my_org_volunteer_ids())
    and volunteer_id is distinct from (select private.current_volunteer_id())
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

create policy "application_notes: admins read own org"
  on public.application_notes for select to authenticated
  using (application_id in (select private.my_admin_application_ids()));

create policy "application_notes: admins create in own org"
  on public.application_notes for insert to authenticated
  with check (application_id in (select private.my_admin_application_ids()));

create policy "application_notes: admins update in own org"
  on public.application_notes for update to authenticated
  using (application_id in (select private.my_admin_application_ids()))
  with check (application_id in (select private.my_admin_application_ids()));

create policy "application_notes: admins delete in own org"
  on public.application_notes for delete to authenticated
  using (application_id in (select private.my_admin_application_ids()));
