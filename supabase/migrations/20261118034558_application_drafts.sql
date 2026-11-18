-- Application drafts: in-progress answers a volunteer is still editing,
-- before they submit (public.applications). One per volunteer - saving
-- again replaces it. Nobody reviews a draft, so staff get no access at all;
-- this is purely the owning volunteer's own in-progress state.

create table public.application_drafts (
  volunteer_id uuid primary key references public.volunteers (id) on delete cascade,
  responses jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.application_drafts
  for each row execute function private.set_updated_at();
alter table public.application_drafts enable row level security;

revoke all on table public.application_drafts from anon, authenticated;
grant select, insert, update, delete on table public.application_drafts to service_role;
grant select, delete on table public.application_drafts to authenticated;
grant insert (volunteer_id, responses) on table public.application_drafts to authenticated;
-- volunteer_id is grantable here too, not just responses: PostgREST's
-- upsert (on_conflict=volunteer_id) always puts every submitted column,
-- including the conflict target, in the UPDATE's SET list - Postgres then
-- requires UPDATE privilege on that column even though its value never
-- actually changes (RLS's with check still blocks setting it to anyone
-- else's volunteer_id).
grant update (responses, volunteer_id) on table public.application_drafts to authenticated;

create policy "application_drafts: volunteers manage their own"
  on public.application_drafts for all to authenticated
  using (volunteer_id = (select private.current_volunteer_id()))
  with check (volunteer_id = (select private.current_volunteer_id()));

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
