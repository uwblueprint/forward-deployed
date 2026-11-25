-- Review follow-ups: blank messages and length limits.
--
-- A rejection message of only spaces, tabs, or newlines counts as blank and
-- gets the organization's default, like an empty one. btrim alone only strips
-- spaces, so a message of newlines used to be saved and shown as nothing.
--
-- The app limits how long these texts can be, but the API can be called
-- directly, so the database holds the same limits. Names are shown to staff in
-- lists; messages and notes are shown on the application.
create or replace function private.review_application() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'approved' then
    new.applicant_message = null;
  elsif new.status = 'rejected' and (new.applicant_message is null or new.applicant_message !~ '\S') then
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

alter table public.applications
  add constraint applications_applicant_message_length check (char_length(applicant_message) <= 2000);
alter table public.application_notes
  add constraint application_notes_internal_note_length check (char_length(internal_note) <= 5000);
alter table public.organizations
  add constraint organizations_default_rejection_message_length check (char_length(default_rejection_message) <= 2000);
alter table public.users
  add constraint users_name_length check (char_length(first_name) <= 100 and char_length(last_name) <= 100);
