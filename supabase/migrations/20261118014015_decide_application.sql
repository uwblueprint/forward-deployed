-- Application decisions (FOR-65): public.decide_application is the only way
-- to approve or reject through the API. Staff decide applications in their
-- organization, never their own. A pending application can be approved or
-- rejected, and an approval can be revoked by rejecting it. Anything else,
-- including deciding the same thing twice, is refused.
-- Usage: supabase.rpc("decide_application", { target_application_id, decision, message?, note? })

revoke update (status, applicant_message) on table public.applications from authenticated;
drop policy "applications: staff review own org" on public.applications;

-- message is shown to the applicant (blank on a rejection uses the
-- organization's default). note is the admin-only internal note, saved in
-- the same transaction.
create function public.decide_application(
  target_application_id uuid,
  decision public.volunteer_status,
  message text default null,
  note text default null
) returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  app public.applications;
begin
  if not coalesce((select private.is_staff()), false) then
    raise exception 'Only staff can decide applications' using errcode = '42501';
  end if;

  select * into app from public.applications
  where id = target_application_id and volunteer_id in (select private.my_org_volunteer_ids())
  for update;
  if not found then
    raise exception 'Application not found in your organization' using errcode = '42501';
  end if;
  if app.volunteer_id = (select private.current_volunteer_id()) then
    raise exception 'You cannot review your own application' using errcode = '42501';
  end if;
  if nullif(btrim(note), '') is not null and not (select private.is_admin()) then
    raise exception 'Only admins can write internal notes' using errcode = '42501';
  end if;
  if app.status = decision then
    raise exception 'Application is already %', decision using errcode = '22023';
  end if;
  if ((app.status = 'pending' and decision in ('approved', 'rejected'))
      or (app.status = 'approved' and decision = 'rejected')) is not true then
    raise exception 'Application is % and cannot become %', app.status, coalesce(decision::text, 'blank') using errcode = '22023';
  end if;

  update public.applications
  set status = decision, applicant_message = message, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = app.id
  returning * into app;

  if nullif(btrim(note), '') is not null then
    insert into public.application_notes (application_id, internal_note, updated_by)
    values (app.id, note, (select auth.uid()))
    on conflict (application_id) do update set internal_note = excluded.internal_note, updated_by = excluded.updated_by;
  end if;

  return app;
end;
$$;

revoke execute on function public.decide_application(uuid, public.volunteer_status, text, text) from public, anon;
grant execute on function public.decide_application(uuid, public.volunteer_status, text, text) to authenticated;
