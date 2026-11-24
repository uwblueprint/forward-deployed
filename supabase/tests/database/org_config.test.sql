-- Organization configuration and custom question answers (FOR-64).
-- Run: npx supabase test db. Rolls back.
-- Users: a0 admin, a1 approved volunteer, a2 volunteer who hasn't applied, a5 manager.
-- Questions: 71 and 79 application, 72-77 registration in org A, 7b required registration in org B.

begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Start from no organization, so the suite also passes on a seeded database.
delete from public.organizations;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-0000000000a0', 'admin.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a1', 'approved.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a2', 'new.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a5', 'manager.a@example.com');

insert into public.organizations (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Org A'),
  ('10000000-0000-0000-0000-00000000000b', 'Org B');

insert into public.memberships (user_id, organization_id, role) values
  ('20000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-00000000000a', 'admin'),
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-00000000000a', 'manager');

insert into public.custom_fields (id, organization_id, entity_type, field_name, field_type, required, options, position) values
  ('70000000-0000-0000-0000-000000000071', '10000000-0000-0000-0000-00000000000a', 'application', 'Why do you want to help?', 'textarea', true, '[]', 0),
  ('70000000-0000-0000-0000-000000000072', '10000000-0000-0000-0000-00000000000a', 'registration', 'Shirt size', 'select', true, '["S", "M", "L"]', 0),
  ('70000000-0000-0000-0000-000000000073', '10000000-0000-0000-0000-00000000000a', 'registration', 'Dietary needs', 'multiselect', false, '["Vegan", "Halal", "None"]', 1),
  ('70000000-0000-0000-0000-000000000074', '10000000-0000-0000-0000-00000000000a', 'registration', 'Arrival date', 'date', false, '[]', 2),
  ('70000000-0000-0000-0000-000000000075', '10000000-0000-0000-0000-00000000000a', 'registration', 'Guests', 'number', false, '[]', 3),
  ('70000000-0000-0000-0000-000000000076', '10000000-0000-0000-0000-00000000000a', 'registration', 'Need a ride?', 'checkbox', false, '[]', 4),
  ('70000000-0000-0000-0000-000000000077', '10000000-0000-0000-0000-00000000000a', 'registration', 'Notes', 'text', false, '[]', 5),
  ('70000000-0000-0000-0000-00000000007b', '10000000-0000-0000-0000-00000000000b', 'registration', 'Org B question', 'text', true, '[]', 0);

insert into public.volunteers (id, user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2');
insert into public.applications (volunteer_id, status, responses) values
  ('30000000-0000-0000-0000-0000000000a1', 'approved', '{"70000000-0000-0000-0000-000000000071": "To help out"}');
insert into public.events (id, organization_id, status, title, starts_at, ends_at) values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'published', 'A event', now() + interval '1 day', now() + interval '1 day 2 hours'),
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'draft', 'B draft', now() + interval '1 day', now() + interval '1 day 2 hours');

-- Configuration ----------------------------------------------------------------

select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'registration', 'Pick one', 'select') $$,
  '23514', null, 'a select question needs options');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type, options) values ('10000000-0000-0000-0000-00000000000a', 'registration', 'Name', 'text', '["x"]') $$,
  '23514', null, 'a text question has no options');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'registration', '  ', 'text') $$,
  '23514', null, 'a question needs a name');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'registration', E'\t\n', 'text') $$,
  '23514', null, 'a name of only tabs and newlines is blank too');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type, options) values ('10000000-0000-0000-0000-00000000000a', 'registration', 'Size', 'select', '"S"') $$,
  '23514', null, 'select options must be a list');

-- Reordering questions: all or nothing, admins only, own organization only.
set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select throws_ok($$ select public.reorder_custom_fields('application', array['70000000-0000-0000-0000-000000000071']::uuid[]) $$,
  '42501', null, 'a manager cannot reorder questions');
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ select public.reorder_custom_fields('registration', array[
    '70000000-0000-0000-0000-000000000077', '70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000073',
    '70000000-0000-0000-0000-000000000074', '70000000-0000-0000-0000-000000000075', '70000000-0000-0000-0000-000000000076']::uuid[]) $$,
  'admin reorders their questions');
select results_eq($$ select right(id::text, 2) from public.custom_fields where entity_type = 'registration' and organization_id = '10000000-0000-0000-0000-00000000000a' order by position $$,
  $$ values ('77'), ('72'), ('73'), ('74'), ('75'), ('76') $$, 'the questions take the given order, with no shared positions');
select throws_ok($$ select public.reorder_custom_fields('registration', array['70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000073']::uuid[]) $$,
  '22023', null, 'a list that misses a question changes nothing');
select throws_ok($$ select public.reorder_custom_fields('registration', array[
    '70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000073', '70000000-0000-0000-0000-000000000074',
    '70000000-0000-0000-0000-000000000075', '70000000-0000-0000-0000-000000000076', '70000000-0000-0000-0000-00000000007b']::uuid[]) $$,
  '22023', null, 'another organization''s question cannot be slipped in');
select throws_ok($$ select public.reorder_custom_fields('registration', array[
    '70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000073',
    '70000000-0000-0000-0000-000000000074', '70000000-0000-0000-0000-000000000075', '70000000-0000-0000-0000-000000000076']::uuid[]) $$,
  '22023', null, 'a list that repeats a question changes nothing');
select throws_ok($$ select public.reorder_custom_fields('application', array['70000000-0000-0000-0000-000000000072']::uuid[]) $$,
  '22023', null, 'a question of the other kind is refused');
select throws_ok($$ select public.reorder_custom_fields('registration', '{}') $$,
  '22023', null, 'an empty list is refused while there are questions');
select lives_ok($$ select public.reorder_custom_fields('registration', array[
    '70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000073', '70000000-0000-0000-0000-000000000074',
    '70000000-0000-0000-0000-000000000075', '70000000-0000-0000-0000-000000000076', '70000000-0000-0000-0000-000000000077']::uuid[]) $$,
  'admin puts them back');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ update public.organizations set settings = '{"event_categories": ["Food security", "Tutoring"], "skills": ["Driving", "First aid"]}' where id = '10000000-0000-0000-0000-00000000000a' $$,
  'admin can type their own event categories and skill options');
select throws_ok($$ update public.organizations set settings = '{"skills": ["Driving", 3]}' where id = '10000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'skill options must be text');
select throws_ok($$ update public.organizations set settings = '{"event_categories": ["", "Tutoring"]}' where id = '10000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'event categories can''t be blank');
select throws_ok($$ update public.organizations set settings = '{"skills": ["\t\n"]}' where id = '10000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'a skill of only tabs and newlines is blank too');
select throws_ok($$ update public.organizations set settings = '[]' where id = '10000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'settings must be an object');
select lives_ok($$ update public.organizations set settings = '{"event_categories": ["Tutoring"], "skills": null}' where id = '10000000-0000-0000-0000-00000000000a' $$,
  'a list can be cleared with null');
reset role;

-- Registration answers ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{}') $$,
  '22023', 'Shirt size is required', 'a required question must be answered');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "XXL"}') $$,
  '22023', 'Shirt size has an invalid value', 'a select answer must be one of its options');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000073": ["Vegan", "Keto"]}') $$,
  '22023', 'Dietary needs has an invalid value', 'a multiselect answer must use its options');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000074": "next tuesday"}') $$,
  '22023', 'Arrival date has an invalid value', 'a date answer must be a date');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000074": "today"}') $$,
  '22023', 'Arrival date has an invalid value', 'a date answer can''t be a word Postgres understands');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000074": "2027-02-30"}') $$,
  '22023', 'Arrival date has an invalid value', 'a date answer must exist on the calendar');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '[]') $$, '22023', 'Answers must be an object keyed by question id', 'answers must be an object');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'registering for another organization''s event fails without naming its questions');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000075": "2"}') $$,
  '22023', 'Guests has an invalid value', 'a number answer must be a number');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000076": "yes"}') $$,
  '22023', 'Need a ride? has an invalid value', 'a checkbox answer must be true or false');
select lives_ok($$ insert into public.registrations (event_id, volunteer_id, custom_responses) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1',
  '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000073": ["Vegan"], "70000000-0000-0000-0000-000000000074": "2027-01-05",
    "70000000-0000-0000-0000-000000000075": 2, "70000000-0000-0000-0000-000000000076": true, "70000000-0000-0000-0000-000000000077": "",
    "70000000-0000-0000-0000-00000000007b": "org B", "not-a-question": "x"}') $$, 'valid answers are accepted');
select is((select custom_responses from public.registrations where volunteer_id = '30000000-0000-0000-0000-0000000000a1'),
  '{"70000000-0000-0000-0000-000000000072": "M", "70000000-0000-0000-0000-000000000073": ["Vegan"], "70000000-0000-0000-0000-000000000074": "2027-01-05", "70000000-0000-0000-0000-000000000075": 2, "70000000-0000-0000-0000-000000000076": true}'::jsonb,
  'blank answers and answers to questions this organization didn''t ask are dropped');
select is((select jsonb_path_query_array(questions, '$[*].field_name') from public.registrations where volunteer_id = '30000000-0000-0000-0000-0000000000a1'),
  '["Shirt size", "Dietary needs", "Arrival date", "Guests", "Need a ride?", "Notes"]'::jsonb, 'the registration keeps the questions as they were asked');
select throws_ok($$ update public.registrations set questions = '[]' $$, '42501', null, 'nobody can write the question snapshot directly');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ update public.custom_fields set field_name = 'T-shirt size' where id = '70000000-0000-0000-0000-000000000072' $$, 'admin renames a question');
select is((select questions -> 0 ->> 'field_name' from public.registrations where volunteer_id = '30000000-0000-0000-0000-0000000000a1'), 'Shirt size',
  'an existing answer keeps the original question');
select throws_ok($$ update public.registrations set custom_responses = '{"70000000-0000-0000-0000-000000000072": "XL"}' where volunteer_id = '30000000-0000-0000-0000-0000000000a1' $$,
  '22023', 'Shirt size has an invalid value', 'staff edits are checked against the questions as they were asked');
select lives_ok($$ update public.custom_fields set options = '["Small", "Medium", "Large"]' where id = '70000000-0000-0000-0000-000000000072' $$, 'admin renames the options');
select lives_ok($$ delete from public.custom_fields where id = '70000000-0000-0000-0000-000000000073' $$, 'admin deletes a question');
select results_eq($$ update public.registrations set custom_responses = custom_responses || '{"70000000-0000-0000-0000-000000000074": "2027-01-06"}'
    where volunteer_id = '30000000-0000-0000-0000-0000000000a1' returning custom_responses -> '70000000-0000-0000-0000-000000000073', jsonb_array_length(questions) $$,
  $$ values ('["Vegan"]'::jsonb, 6) $$, 'editing one answer keeps the others, even after their questions change');
reset role;

-- Application answers ------------------------------------------------------------

update public.applications set questions = '[]' where volunteer_id = '30000000-0000-0000-0000-0000000000a1';
select results_eq($$ update public.applications set responses = '{"70000000-0000-0000-0000-000000000071": "Still keen"}' where volunteer_id = '30000000-0000-0000-0000-0000000000a1' returning jsonb_array_length(questions) $$,
  $$ values (1) $$, 'an application saved before snapshots existed gets one when edited');
insert into public.custom_fields (id, organization_id, entity_type, field_name, field_type, required, options, position) values
  ('70000000-0000-0000-0000-000000000079', '10000000-0000-0000-0000-00000000000a', 'application', 'Days', 'multiselect', true, '["Mon", "Tue"]', 1);

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select throws_ok($$ insert into public.applications (volunteer_id, responses) values ('30000000-0000-0000-0000-0000000000a2', '{"phone": "519-555-0100"}') $$,
  '22023', 'Why do you want to help? is required', 'an application must answer the required questions');
select throws_ok($$ insert into public.applications (volunteer_id, responses) values ('30000000-0000-0000-0000-0000000000a2', '{"70000000-0000-0000-0000-000000000071": "I like people", "70000000-0000-0000-0000-000000000079": []}') $$,
  '22023', 'Days is required', 'an empty multiselect doesn''t answer a required question');
select lives_ok($$ insert into public.applications (volunteer_id, responses) values ('30000000-0000-0000-0000-0000000000a2', '{"70000000-0000-0000-0000-000000000071": "I like people", "70000000-0000-0000-0000-000000000079": ["Mon"]}') $$,
  'an application with its answers is accepted');
select results_eq($$ select responses, jsonb_array_length(questions) from public.applications where volunteer_id = '30000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('{"70000000-0000-0000-0000-000000000071": "I like people", "70000000-0000-0000-0000-000000000079": ["Mon"]}'::jsonb, 2) $$, 'the application keeps its answers and the questions it answered');
reset role;
select throws_ok($$ update public.applications set responses = '{"70000000-0000-0000-0000-000000000071": ""}' where volunteer_id = '30000000-0000-0000-0000-0000000000a2' $$,
  '22023', 'Why do you want to help? is required', 'edits to application answers are checked too');

select * from finish();
rollback;
