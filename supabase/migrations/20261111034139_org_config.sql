-- Organization configuration and custom question answers (FOR-64).

-------------------------------------------------------------------------------
-- Configuration checks
-------------------------------------------------------------------------------

-- A JSON list of non-blank strings, or nothing at all.
create function private.is_text_list(value jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select value is null or value = 'null'::jsonb or (
    jsonb_typeof(value) = 'array'
    and not exists (select 1 from jsonb_array_elements(value) item where jsonb_typeof(item) <> 'string' or item #>> '{}' !~ '\S')
  )
$$;

-- Event categories and skill options are free text the organization types in;
-- settings.event_categories and settings.skills only have to be lists of them.
alter table public.organizations
  add constraint organizations_settings_lists check (
    jsonb_typeof(settings) = 'object'
    and private.is_text_list(settings -> 'event_categories')
    and private.is_text_list(settings -> 'skills')
  );

-- Select and multiselect questions need their options; other types have none.
alter table public.custom_fields
  add constraint custom_fields_field_name_check check (field_name ~ '\S'),
  add constraint custom_fields_options_check check (
    case when field_type in ('select', 'multiselect')
      then jsonb_typeof(options) = 'array' and options <> '[]'::jsonb and private.is_text_list(options)
      else options = '[]'::jsonb
    end
  );

-------------------------------------------------------------------------------
-- Answers
-------------------------------------------------------------------------------

-- The questions as they were asked, so later edits to custom_fields don't
-- change what an old answer meant. Set by the database; not writable.
alter table public.applications add column questions jsonb not null default '[]';
alter table public.registrations add column questions jsonb not null default '[]';

-- Dates are calendar dates, YYYY-MM-DD, like a date input sends.
create function private.answer_matches_type(field public.custom_fields, value jsonb) returns boolean
language plpgsql stable set search_path = ''
as $$
begin
  case field.field_type
    when 'text', 'textarea' then return jsonb_typeof(value) = 'string';
    when 'number' then return jsonb_typeof(value) = 'number';
    when 'checkbox' then return jsonb_typeof(value) = 'boolean';
    when 'select' then return jsonb_typeof(value) = 'string' and field.options @> jsonb_build_array(value);
    when 'multiselect' then return jsonb_typeof(value) = 'array' and field.options @> value
      and not exists (select 1 from jsonb_array_elements(value) item where jsonb_typeof(item) <> 'string');
    when 'date' then
      if jsonb_typeof(value) <> 'string' or value #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$' then
        return false;
      end if;
      begin
        perform (value #>> '{}')::date;
      exception when others then
        return false; -- e.g. 2026-02-30
      end;
      return true;
    else return false;
  end case;
end;
$$;

-- Same rules as validateCustomFieldAnswers in src/lib/customFieldAnswers.ts:
-- every required question has an answer, every answer matches its question's
-- type, and answers to questions the organization didn't ask are dropped.
-- A new row is checked against the organization's current questions, which
-- are saved in `questions`. Edits are checked against the saved questions, so
-- changing or deleting a question later never touches existing answers.
-- Runs as the caller (not security definer), so it only reads questions the
-- caller can already see and can't reveal another organization's.
create function private.check_answers() returns trigger
language plpgsql set search_path = ''
as $$
declare
  is_application boolean := tg_table_name = 'applications';
  answers jsonb := to_jsonb(new) -> (case when is_application then 'responses' else 'custom_responses' end);
  asked jsonb;
  org uuid;
  field public.custom_fields;
  value jsonb;
  kept jsonb := '{}';
begin
  if jsonb_typeof(answers) <> 'object' then
    raise exception 'Answers must be an object keyed by question id' using errcode = '22023';
  end if;

  -- Rows saved before snapshots existed have none; they use the current questions.
  if tg_op = 'UPDATE' and old.questions <> '[]'::jsonb then
    asked := old.questions;
  else
    if is_application then
      select organization_id into org from public.volunteers where id = (to_jsonb(new) ->> 'volunteer_id')::uuid;
    else
      select organization_id into org from public.events where id = (to_jsonb(new) ->> 'event_id')::uuid;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'field_name', field_name, 'field_type', field_type, 'options', options, 'required', required
      ) order by position, id), '[]')
    into asked
    from public.custom_fields
    where organization_id = org and entity_type = case when is_application then 'application' else 'registration' end;
  end if;
  new.questions := asked;

  for field in select * from jsonb_populate_recordset(null::public.custom_fields, asked) loop
    value := answers -> field.id::text;
    if value is null or value = 'null' or value = '""' or value = '[]' then
      if field.required then
        raise exception '% is required', field.field_name using errcode = '22023';
      end if;
    elsif not private.answer_matches_type(field, value) then
      raise exception '% has an invalid value', field.field_name using errcode = '22023';
    else
      kept := kept || jsonb_build_object(field.id::text, value);
    end if;
  end loop;

  if is_application then
    new.responses := kept;
  else
    new.custom_responses := kept;
  end if;
  return new;
end;
$$;

create trigger check_answers
  before insert on public.applications
  for each row execute function private.check_answers();
create trigger check_answers_on_update
  before update of responses on public.applications
  for each row when (old.responses is distinct from new.responses)
  execute function private.check_answers();

create trigger check_answers
  before insert on public.registrations
  for each row execute function private.check_answers();
create trigger check_answers_on_update
  before update of custom_responses on public.registrations
  for each row when (old.custom_responses is distinct from new.custom_responses)
  execute function private.check_answers();

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
