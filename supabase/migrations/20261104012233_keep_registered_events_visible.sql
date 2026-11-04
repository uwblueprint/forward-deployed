-- Volunteers lost sight of their own registrations, and of the events behind
-- them, once an admin marked an event cancelled or completed. The registrations
-- policy looked the event up through events RLS, which only showed volunteers
-- published events.
--
-- Now a volunteer always sees their own registrations, and can read any
-- non-draft event in their organization that they registered for. Drafts stay
-- admin-only.

-- security definer so the events policy can check registrations without
-- triggering registrations RLS (which reads events, and would recurse).
create function public.is_registered_for(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.registrations r
    join public.volunteers v on v.id = r.volunteer_id
    where r.event_id = target_event_id
      and v.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_registered_for(uuid) from public, anon;
grant execute on function public.is_registered_for(uuid) to authenticated, service_role;

alter policy "events: volunteers read published, admins read all"
  on public.events
  using (
    organization_id = (select public.current_org_id())
    and (
      status = 'published'
      or (select public.is_admin())
      or (status <> 'draft' and public.is_registered_for(id))
    )
  );

alter policy "events: volunteers read published, admins read all"
  on public.events
  rename to "events: read published or registered, admins read all";

-- A volunteer can only ever register for events in their own organization, so
-- their own registrations need no extra organization check.
alter policy "registrations: read own, admins read own org"
  on public.registrations
  using (
    registrations.volunteer_id = (select public.current_volunteer_id())
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.events e
        where e.id = registrations.event_id
          and e.organization_id = (select public.current_org_id())
      )
    )
  );
