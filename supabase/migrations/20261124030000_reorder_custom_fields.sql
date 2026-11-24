-- Reordering custom questions (FOR-118). One call puts an organization's
-- application or registration questions in the given order, all or nothing,
-- so a failed or interleaved reorder can't leave the list half-moved. Admins only, like every other change to custom_fields; it runs
-- with the caller's permissions, so RLS still applies.
--
-- ordered_ids must be exactly that kind's questions. If one was added or
-- removed since the caller loaded them, nothing changes.
--
-- Usage: supabase.rpc("reorder_custom_fields", { target_entity_type, ordered_ids })
-- Errors: 42501 not an admin, 22023 the ids aren't exactly the current questions.
create function public.reorder_custom_fields(target_entity_type text, ordered_ids uuid[])
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  org uuid := (select private.current_org_id());
  current_ids uuid[];
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can reorder questions' using errcode = '42501';
  end if;

  -- Locks the rows, so two reorders at once run one after the other.
  select coalesce(array_agg(id order by id), '{}') into current_ids
  from (
    select id from public.custom_fields
    where organization_id = org and entity_type = target_entity_type
    for update
  ) locked;

  if current_ids is distinct from coalesce((select array_agg(id order by id) from unnest(ordered_ids) as given(id)), '{}') then
    raise exception 'The questions changed; reload and try again' using errcode = '22023';
  end if;

  update public.custom_fields field
  set position = given.place - 1
  from unnest(ordered_ids) with ordinality as given(id, place)
  where field.id = given.id and field.position is distinct from given.place - 1;
end;
$$;

revoke execute on function public.reorder_custom_fields(text, uuid[]) from public, anon;
grant execute on function public.reorder_custom_fields(text, uuid[]) to authenticated;
