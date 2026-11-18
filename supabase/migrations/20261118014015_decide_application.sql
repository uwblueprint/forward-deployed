-- Application decisions (FOR-65): public.decide_application is the only way
-- to approve or reject through the API. Staff decide applications in their
-- organization, never their own.
--
-- The caller passes the status they saw (pending unless they say otherwise),
-- so nobody overturns a decision they haven't seen. To change a decision, for
-- example to fix a mistake, pass the current status. Only the volunteer's
-- latest application can be decided, nothing goes back to pending, and
-- repeating a decision is refused.
--
-- Usage: supabase.rpc("decide_application", { target_application_id, decision, message?, note?, expected_status? })
-- Errors: 42501 not allowed, P0002 not found, 55000 not the latest
-- application, 22023 already decided or no longer in the expected status.

revoke update (status, applicant_message) on table public.applications from authenticated;
drop policy "applications: staff review own org" on public.applications;

-- message is shown to the applicant (blank on a rejection uses the
-- organization's default). note is the admin-only internal note; it replaces
-- any earlier note and is saved in the same transaction.
create function public.decide_application(
  target_application_id uuid,
  decision public.volunteer_status,
  message text default null,
  note text default null,
  expected_status public.volunteer_status default 'pending'
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
    raise exception 'Application not found in your organization' using errcode = 'P0002';
  end if;
  if app.volunteer_id = (select private.current_volunteer_id()) then
    raise exception 'You cannot review your own application' using errcode = '42501';
  end if;
  if nullif(btrim(note), '') is not null and not (select private.is_admin()) then
    raise exception 'Only admins can write internal notes' using errcode = '42501';
  end if;
  if (decision in ('approved', 'rejected')) is not true then
    raise exception 'The decision must be approved or rejected' using errcode = '22023';
  end if;

  -- Locking the volunteer makes an application they're submitting right now
  -- either finish first (and fail the check below) or wait for this decision.
  perform 1 from public.volunteers where id = app.volunteer_id for update;
  if exists (select 1 from public.applications
             where volunteer_id = app.volunteer_id and (submitted_at, id) > (app.submitted_at, app.id)) then
    raise exception 'Only the latest application can be decided' using errcode = '55000';
  end if;
  if app.status = decision then
    raise exception 'Application is already %', decision using errcode = '22023';
  end if;
  if app.status is distinct from expected_status then
    raise exception 'Application is %, not %', app.status, coalesce(expected_status::text, 'blank') using errcode = '22023';
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

revoke execute on function public.decide_application(uuid, public.volunteer_status, text, text, public.volunteer_status) from public, anon;
grant execute on function public.decide_application(uuid, public.volunteer_status, text, text, public.volunteer_status) to authenticated;

-- Fixing the message on a rejection without deciding again. A blank message
-- uses the organization's default. Same access rules as decide_application.
-- Usage: supabase.rpc("edit_applicant_message", { target_application_id, message })
-- Errors: 42501 not allowed, P0002 not found, 22023 not rejected.
create function public.edit_applicant_message(target_application_id uuid, message text)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  app public.applications;
begin
  if not coalesce((select private.is_staff()), false) then
    raise exception 'Only staff can edit applicant messages' using errcode = '42501';
  end if;

  select * into app from public.applications
  where id = target_application_id and volunteer_id in (select private.my_org_volunteer_ids())
  for update;
  if not found then
    raise exception 'Application not found in your organization' using errcode = 'P0002';
  end if;
  if app.volunteer_id = (select private.current_volunteer_id()) then
    raise exception 'You cannot review your own application' using errcode = '42501';
  end if;
  if app.status <> 'rejected' then
    raise exception 'Only a rejected application has a message' using errcode = '22023';
  end if;

  update public.applications set applicant_message = message where id = app.id returning * into app;
  return app;
end;
$$;

revoke execute on function public.edit_applicant_message(uuid, text) from public, anon;
grant execute on function public.edit_applicant_message(uuid, text) to authenticated;
