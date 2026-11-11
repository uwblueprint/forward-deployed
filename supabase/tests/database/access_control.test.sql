-- Access-control tests. Run: npx supabase test db (needs npx supabase start).
-- Runs in one transaction and rolls back.
-- ID prefixes: 1 org, 2 user, 3 volunteer, 4 event, 5 registration, 6 application, 7 custom field.
-- Suffix a/b = org A or B. Users: a0 admin, a1 approved, a2 pending, a3 rejected,
-- a4 no profile yet (but an old approved one in org B), a5 manager, b0 admin, b1 approved,
-- f0 signup, f1 signup with no email.

begin;
create extension if not exists pgtap with schema extensions;
select plan(186);

insert into public.organizations (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Org A'),
  ('10000000-0000-0000-0000-00000000000b', 'Org B');

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-0000000000a0', 'admin.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a1', 'approved.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a2', 'pending.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a3', 'rejected.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a4', 'new.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a5', 'manager.a@example.com'),
  ('20000000-0000-0000-0000-0000000000b0', 'admin.b@example.com'),
  ('20000000-0000-0000-0000-0000000000b1', 'approved.b@example.com');

insert into public.memberships (user_id, organization_id, role) values
  ('20000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-00000000000a', 'admin'),
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-00000000000a', 'manager'),
  ('20000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-00000000000b', 'admin'),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'volunteer');

insert into public.volunteers (id, user_id, organization_id) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b'),
  ('30000000-0000-0000-0000-0000000000b4', '20000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-00000000000b');

insert into public.applications (id, volunteer_id, status, applicant_message) values
  ('60000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', 'approved', null),
  ('60000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a2', 'pending', null),
  ('60000000-0000-0000-0000-0000000000a3', '30000000-0000-0000-0000-0000000000a3', 'rejected', 'Please reapply in the spring.'),
  ('60000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1', 'approved', null),
  ('60000000-0000-0000-0000-0000000000b4', '30000000-0000-0000-0000-0000000000b4', 'approved', null);

insert into public.application_notes (application_id, internal_note) values
  ('60000000-0000-0000-0000-0000000000a2', 'Second interview booked.'),
  ('60000000-0000-0000-0000-0000000000a3', 'References did not reply.'),
  ('60000000-0000-0000-0000-0000000000b1', 'Org B note.');

insert into public.events (id, organization_id, status, title, starts_at, ends_at) values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'published', 'A published', now() + interval '1 day', now() + interval '1 day 2 hours'),
  ('40000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'draft', 'A draft', now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'completed', 'A completed', now() - interval '7 days', now() - interval '7 days' + interval '2 hours'),
  ('40000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-00000000000a', 'cancelled', 'A cancelled', now() + interval '3 days', now() + interval '3 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-00000000000a', 'published', 'A already started', now() - interval '1 hour', now() + interval '1 hour'),
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'published', 'B published', now() + interval '1 day', now() + interval '1 day 2 hours');

insert into public.registrations (id, event_id, volunteer_id, attendance_status) values
  ('50000000-0000-0000-0000-0000000000a3', '40000000-0000-0000-0000-0000000000a3', '30000000-0000-0000-0000-0000000000a1', 'attended'),
  ('50000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1', null);

insert into public.custom_fields (id, organization_id, entity_type, field_name, field_type) values
  ('70000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'application', 'Why do you want to volunteer?', 'textarea'),
  ('70000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'application', 'Do you have a car?', 'checkbox');

-- Schema ---------------------------------------------------------------------

select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint,
  'RLS is enabled on every public table');
select is((select string_agg(p.proname::text, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  'create_invitation,redeem_invitation,registration_count,revoke_invitation,set_user_role', 'the API schema exposes only the intended functions');
select is((select string_agg(p.proname::text, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  'create_invitation,redeem_invitation,registration_count,revoke_invitation,set_user_role', 'signed-in users can call only those functions');
select is((select (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public')
  + (select count(*) from information_schema.column_privileges where grantee = 'anon' and table_schema = 'public')
  + (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute'))),
  0::bigint, 'anon has no grants on tables, columns, or functions');
select is((select string_agg(format('%s %s', table_name, privilege_type), ', ' order by table_name::text collate "C", privilege_type::text collate "C")
  from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public'),
  'application_notes DELETE, application_notes SELECT, applications SELECT, audit_log SELECT, custom_fields DELETE, custom_fields SELECT, events DELETE, events SELECT, '
  'invitations SELECT, memberships SELECT, organizations SELECT, registrations DELETE, registrations SELECT, users SELECT, volunteers SELECT',
  'signed-in users have only these table-wide grants');
-- Changing a grant means updating this list on purpose.
select is((select string_agg(line, E'\n' order by line collate "C") from (
    select format('%s %s: %s', table_name, privilege_type, string_agg(column_name::text, ', ' order by column_name::text collate "C")) as line
    from information_schema.column_privileges
    where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE')
    group by table_name, privilege_type
  ) t),
  $grants$application_notes INSERT: application_id, internal_note
application_notes UPDATE: internal_note
applications INSERT: responses, volunteer_id
applications UPDATE: applicant_message, status
custom_fields INSERT: entity_type, field_name, field_type, options, organization_id, position, required
custom_fields UPDATE: entity_type, field_name, field_type, options, position, required
events INSERT: capacity, category, description, ends_at, location, organization_id, registration_deadline, requirements, starts_at, status, title
events UPDATE: capacity, category, description, ends_at, location, registration_deadline, requirements, starts_at, status, title
organizations UPDATE: default_rejection_message, logo_url, name, primary_color, secondary_color, settings
registrations INSERT: custom_responses, event_id, status, volunteer_id
registrations UPDATE: attendance_status, custom_responses, status
users UPDATE: first_name, last_name
volunteers INSERT: availability_days, consent_accepted_at, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, location, phone, shift_preference, skills, user_id
volunteers UPDATE: availability_days, consent_accepted_at, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, location, phone, shift_preference, skills$grants$, 'signed-in users can write only these columns');
select throws_ok($$ insert into public.memberships (user_id, organization_id) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000b') $$,
  '23505', null, 'a user belongs to at most one organization');
select throws_ok($$ insert into public.events (organization_id, title, starts_at, ends_at, registration_deadline) values ('10000000-0000-0000-0000-00000000000a', 'x', now(), now() + interval '1 hour', now() + interval '1 day') $$,
  '23514', null, 'the registration deadline cannot be after the event starts');
select results_eq($$ select status::text from public.volunteers where id::text like '30000000-0000-0000-0000-0000000000a_' order by id $$,
  $$ values ('approved'), ('pending'), ('rejected') $$,
  'volunteer status mirrors their latest application');

insert into auth.users (id, email, raw_user_meta_data) values ('20000000-0000-0000-0000-0000000000f0', 'signup@example.com',
  '{"full_name": "Sam Signup", "role": "admin", "organization_id": "10000000-0000-0000-0000-00000000000a"}');
select results_eq($$ select first_name, last_name, email from public.users where id = '20000000-0000-0000-0000-0000000000f0' $$,
  $$ values ('Sam', 'Signup', 'signup@example.com') $$, 'signup creates a user row and splits the name');
select is_empty($$ select 1 from public.memberships where user_id = '20000000-0000-0000-0000-0000000000f0' $$,
  'signup ignores role and org metadata and creates no membership');

insert into auth.users (id, phone, raw_user_meta_data) values ('20000000-0000-0000-0000-0000000000f1', '15195550100', '{"given_name": "Pat", "family_name": "Phone"}');
select results_eq($$ select first_name, last_name, email from public.users where id = '20000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('Pat', 'Phone', null::text) $$, 'signup without an email still creates the user row');

update auth.users set email = 'renamed@example.com' where id = '20000000-0000-0000-0000-0000000000f0';
select is((select email from public.users where id = '20000000-0000-0000-0000-0000000000f0'), 'renamed@example.com',
  'email changes are mirrored to public.users');

-- Logged out -------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok('select * from public.organizations', '42501', null, 'anon cannot read organizations');
select throws_ok('select * from public.users', '42501', null, 'anon cannot read users');
select throws_ok('select * from public.memberships', '42501', null, 'anon cannot read memberships');
select throws_ok('select * from public.volunteers', '42501', null, 'anon cannot read volunteers');
select throws_ok('select * from public.applications', '42501', null, 'anon cannot read applications');
select throws_ok('select * from public.application_notes', '42501', null, 'anon cannot read application notes');
select throws_ok('select * from public.events', '42501', null, 'anon cannot read events');
select throws_ok('select * from public.registrations', '42501', null, 'anon cannot read registrations');
select throws_ok('select * from public.custom_fields', '42501', null, 'anon cannot read custom fields');
select throws_ok('select private.is_admin()', '42501', null, 'anon cannot call helper functions');
select throws_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a1', 'admin') $$, '42501', null, 'anon cannot change roles');
reset role;

-- Approved volunteer, org A ------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq('select id from public.organizations', $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$, 'volunteer sees only their org');
select results_eq('select id from public.users', $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their user row');
select results_eq('select organization_id, role::text from public.memberships', $$ values ('10000000-0000-0000-0000-00000000000a'::uuid, 'volunteer') $$, 'volunteer sees only their own membership');
select results_eq('select id from public.volunteers', $$ values ('30000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their profile');
select results_eq('select id from public.applications', $$ values ('60000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their applications');
select set_eq('select id from public.events', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a3'), ('40000000-0000-0000-0000-0000000000a5') $$,
  'volunteer sees published events plus past events they registered for, in their org only');
select results_eq('select id from public.registrations', $$ values ('50000000-0000-0000-0000-0000000000a3'::uuid) $$, 'volunteer sees only their registrations');
select results_eq('select id from public.custom_fields', $$ values ('70000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their org''s custom fields');

select lives_ok($$ update public.users set first_name = 'New' where id = '20000000-0000-0000-0000-0000000000a1' $$, 'volunteer can edit their name');
select throws_ok($$ update public.memberships set role = 'admin' where user_id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot change their role');
select throws_ok($$ update public.memberships set organization_id = '10000000-0000-0000-0000-00000000000b' where user_id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot change their org');
select throws_ok($$ insert into public.memberships (user_id, organization_id) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000b') $$, '42501', null, 'volunteer cannot add themselves to an org');
select throws_ok($$ update public.volunteers set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '30000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot move their profile to another org');
select throws_ok($$ update public.users set email = 'x@example.com' where id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot edit the email mirror');
select throws_ok($$ update public.volunteers set status = 'approved' where id = '30000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot set their status');
select lives_ok($$ update public.volunteers set phone = '519-555-0100', shift_preference = 'evening' where id = '30000000-0000-0000-0000-0000000000a1' $$, 'volunteer can edit their profile');
select lives_ok($$ update public.volunteers set consent_accepted_at = '2000-01-01' where id = '30000000-0000-0000-0000-0000000000a1' $$, 'volunteer can record consent');
select is((select consent_accepted_at from public.volunteers where id = '30000000-0000-0000-0000-0000000000a1'), now(), 'the database sets the consent time');
select is_empty($$ update public.volunteers set phone = '000' where id = '30000000-0000-0000-0000-0000000000a2' returning id $$, 'volunteer cannot edit another profile');
select is_empty($$ update public.applications set status = 'approved' where id = '60000000-0000-0000-0000-0000000000a1' returning id $$, 'volunteer cannot review their application');
select throws_ok($$ insert into public.applications (volunteer_id) values ('30000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'approved volunteer cannot apply again');

select is_empty('select * from public.application_notes', 'volunteer cannot read notes on other applications');
select throws_ok($$ insert into public.application_notes (application_id, internal_note) values ('60000000-0000-0000-0000-0000000000a1', 'x') $$, '42501', null, 'volunteer cannot add notes');
update public.application_notes set internal_note = 'edited by a volunteer';
delete from public.application_notes;
reset role;
select is((select count(*) from public.application_notes where application_id::text like '60000000-%' and internal_note <> 'edited by a volunteer'), 3::bigint,
  'volunteer cannot edit or delete notes');
set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select lives_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1') $$, 'approved volunteer can register for a published event');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'volunteer cannot register for a draft');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'volunteer cannot register for an org B event');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3') $$, '42501', null, 'volunteer cannot register someone else');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a5', '30000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'volunteer cannot register for an event that already started');
select throws_ok($$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-0000000000a3' $$, '42501', null, 'volunteer cannot cancel once attendance is recorded');
select throws_ok($$ update public.registrations set attendance_status = 'attended' where event_id = '40000000-0000-0000-0000-0000000000a1' $$, '42501', 'Volunteers can only change the status of their registration', 'volunteer cannot record their own attendance');
select results_eq($$ update public.registrations set status = 'cancelled' where event_id = '40000000-0000-0000-0000-0000000000a1' returning status::text $$, $$ values ('cancelled') $$, 'volunteer can cancel their registration');
select is_empty('delete from public.registrations returning id', 'volunteer cannot delete registrations');
select throws_ok($$ insert into public.events (organization_id, title, starts_at, ends_at) values ('10000000-0000-0000-0000-00000000000a', 'x', now(), now() + interval '1 hour') $$, '42501', null, 'volunteer cannot create events');
select is_empty($$ update public.organizations set name = 'x' returning id $$, 'volunteer cannot edit their org');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'application', 'x', 'text') $$, '42501', null, 'volunteer cannot create custom fields');
reset role;

-- Pending and rejected volunteers, org A ---------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select set_eq('select id from public.events', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a5') $$, 'pending volunteer can browse published events');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2') $$, '42501', null, 'pending volunteer cannot register');
select throws_ok($$ insert into public.applications (volunteer_id) values ('30000000-0000-0000-0000-0000000000a2') $$, '23505', null, 'volunteer cannot have two open applications');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3') $$, '42501', null, 'rejected volunteer cannot register');
select is((select applicant_message from public.applications where id = '60000000-0000-0000-0000-0000000000a3'), 'Please reapply in the spring.', 'applicant can read the message on their application');
select is_empty('select * from public.application_notes', 'applicant cannot read the internal note on their application');
select throws_ok($$ insert into public.application_notes (application_id, internal_note) values ('60000000-0000-0000-0000-0000000000a3', 'x') $$, '42501', null, 'applicant cannot write internal notes');
select lives_ok($$ insert into public.applications (volunteer_id, responses) values ('30000000-0000-0000-0000-0000000000a3', '{"70000000-0000-0000-0000-0000000000a1": "Second try"}') $$, 'rejected volunteer can reapply');
select is((select status::text from public.volunteers where id = '30000000-0000-0000-0000-0000000000a3'), 'pending', 'reapplying puts the volunteer back to pending');
reset role;

-- New user in org A creating a profile and applying -----------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select is_empty('select id from public.volunteers', 'a profile from a previous organization stays with that organization');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000b4') $$, '42501', null, 'an approval from a previous organization does not carry over');
select throws_ok($$ insert into public.volunteers (user_id, organization_id) values ('20000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-00000000000b') $$, '42501', null, 'new volunteer cannot pick the org for their profile');
select throws_ok($$ insert into public.volunteers (user_id, status) values ('20000000-0000-0000-0000-0000000000a4', 'approved') $$, '42501', null, 'new volunteer cannot self-approve');
select throws_ok($$ insert into public.volunteers (user_id) values ('20000000-0000-0000-0000-0000000000a0') $$, '42501', null, 'new volunteer cannot create a profile for someone else');
select lives_ok($$ insert into public.volunteers (user_id, availability_days, shift_preference, consent_accepted_at) values ('20000000-0000-0000-0000-0000000000a4', '{monday,friday}', 'morning', '2000-01-01') $$, 'new volunteer can create their profile');
select results_eq($$ select status::text, organization_id, consent_accepted_at = now() from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4' $$,
  $$ values ('pending', '10000000-0000-0000-0000-00000000000a'::uuid, true) $$, 'new profile is pending, in their org, with a database-set consent time');
select throws_ok($$ update public.volunteers set availability_days = '{someday}' where user_id = '20000000-0000-0000-0000-0000000000a4' $$, '22P02', null, 'availability must be real weekdays');
select lives_ok($$ insert into public.applications (volunteer_id, responses) select id, '{}'::jsonb from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4' $$, 'new volunteer can apply');
reset role;

-- Signed-in user with no organization -------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000f0", "role": "authenticated"}';
select is_empty('select id from public.organizations', 'no-org user sees no organizations');
select is_empty('select id from public.events', 'no-org user sees no events');
select is_empty('select id from public.custom_fields', 'no-org user sees no custom fields');
select lives_ok($$ insert into public.volunteers (user_id, phone) values ('20000000-0000-0000-0000-0000000000f0', '519-555-0111') $$, 'no-org user can fill in a profile before joining');
select results_eq('select organization_id from public.volunteers', $$ values (null::uuid) $$, 'that profile has no organization yet');
select throws_ok($$ insert into public.applications (volunteer_id) select id from public.volunteers $$, '42501', null, 'no-org user cannot apply yet');
reset role;

insert into public.memberships (user_id, organization_id) values ('20000000-0000-0000-0000-0000000000f0', '10000000-0000-0000-0000-00000000000b');
select is((select organization_id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000f0'), '10000000-0000-0000-0000-00000000000b'::uuid,
  'joining an organization brings the profile along');

-- Admin, org A --------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';

select results_eq('select id from public.organizations', $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$, 'admin sees only their org');
select set_eq('select id from public.users', $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid), ('20000000-0000-0000-0000-0000000000a1'), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4'), ('20000000-0000-0000-0000-0000000000a5') $$, 'admin sees every org A user and nobody else');
select set_eq('select user_id from public.memberships', $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid), ('20000000-0000-0000-0000-0000000000a1'), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4'), ('20000000-0000-0000-0000-0000000000a5') $$, 'admin sees every org A membership and nobody else');
select set_eq('select user_id from public.volunteers', $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4') $$, 'admin sees every org A volunteer and none in org B');
select set_eq('select id from public.events', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a2'),
  ('40000000-0000-0000-0000-0000000000a3'), ('40000000-0000-0000-0000-0000000000a4'), ('40000000-0000-0000-0000-0000000000a5') $$, 'admin sees every org A event and none in org B');
select set_eq('select event_id from public.registrations', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a3') $$, 'admin sees org A registrations only');
select is_empty($$ select id from public.applications where volunteer_id = '30000000-0000-0000-0000-0000000000b1' $$, 'admin cannot see org B applications');

select results_eq($$ update public.applications set status = 'approved' where id = '60000000-0000-0000-0000-0000000000a2' returning reviewed_by, reviewed_at = now() $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid, true) $$, 'admin can approve; the database records who and when');
select is((select status::text from public.volunteers where id = '30000000-0000-0000-0000-0000000000a2'), 'approved', 'approval updates the volunteer status');
select lives_ok($$ update public.applications set status = 'approved', applicant_message = 'leftover' where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4') $$, 'admin can approve a new application');
select is((select applicant_message from public.applications where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4')), null, 'approving clears any rejection message');

select results_eq('select internal_note from public.application_notes order by internal_note', $$ values ('References did not reply.'), ('Second interview booked.') $$, 'admin reads their org''s notes only');
select results_eq($$ insert into public.application_notes (application_id, internal_note) values ('60000000-0000-0000-0000-0000000000a1', 'Great with kids.') returning updated_by $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid) $$, 'admin can add a note; the database records who');
select results_eq($$ update public.application_notes set internal_note = 'References replied.' where application_id = '60000000-0000-0000-0000-0000000000a3' returning updated_by $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid) $$, 'admin can edit a note; the database records who');
select results_eq($$ delete from public.application_notes where application_id = '60000000-0000-0000-0000-0000000000a2' returning application_id $$,
  $$ values ('60000000-0000-0000-0000-0000000000a2'::uuid) $$, 'admin can delete a note');
select throws_ok($$ insert into public.application_notes (application_id, internal_note) values ('60000000-0000-0000-0000-0000000000b1', 'x') $$, '42501', null, 'admin cannot note an org B application');
select lives_ok($$ update public.organizations set default_rejection_message = 'Thanks for applying. We are not able to take you on right now.' where id = '10000000-0000-0000-0000-00000000000a' $$, 'admin can set the default rejection message');

select lives_ok($$ update public.volunteers set phone = '519-555-0199', skills = '{Driving}' where id = '30000000-0000-0000-0000-0000000000a2' $$, 'admin can edit a volunteer profile');
select throws_ok($$ update public.volunteers set consent_accepted_at = now() where id = '30000000-0000-0000-0000-0000000000a2' $$, '42501', 'Only the volunteer can record their own consent', 'admin cannot record consent for a volunteer');
select lives_ok($$ update public.volunteers set consent_accepted_at = '2001-01-01', phone = '519-555-0123' where id = '30000000-0000-0000-0000-0000000000a1' $$, 'admin can save a whole profile back');
select is((select consent_accepted_at from public.volunteers where id = '30000000-0000-0000-0000-0000000000a1'), now(), 'saving a profile back keeps the original consent time');
select throws_ok($$ update public.memberships set role = 'manager' where user_id = '20000000-0000-0000-0000-0000000000a4' $$, '42501', null, 'role is not writable directly, even by admins');
select throws_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a0', 'volunteer') $$, '42501', 'You cannot change your own role', 'admin cannot change their own role');
select throws_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000b1', 'admin') $$, '42501', 'User not found in your organization', 'admin cannot change an org B user''s role');
select lives_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a4', 'manager') $$, 'admin can change another user''s role');
select is((select role::text from public.memberships where user_id = '20000000-0000-0000-0000-0000000000a4'), 'manager', 'the role change is saved');
select lives_ok($$ update public.users set last_name = 'Edited' where id = '20000000-0000-0000-0000-0000000000a1' $$, 'admin can edit a user''s name');
select throws_ok($$ update public.memberships set organization_id = '10000000-0000-0000-0000-00000000000b' where user_id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'admin cannot move a user to another org');

select lives_ok($$ insert into public.events (organization_id, title, starts_at, ends_at) values ('10000000-0000-0000-0000-00000000000a', 'New A event', now(), now() + interval '1 hour') $$, 'admin can create an event');
select throws_ok($$ insert into public.events (organization_id, title, starts_at, ends_at) values ('10000000-0000-0000-0000-00000000000b', 'x', now(), now() + interval '1 hour') $$, '42501', null, 'admin cannot create an org B event');
select is_empty($$ update public.events set title = 'x' where id = '40000000-0000-0000-0000-0000000000b1' returning id $$, 'admin cannot edit an org B event');
select is_empty($$ delete from public.events where id = '40000000-0000-0000-0000-0000000000b1' returning id $$, 'admin cannot delete an org B event');
select is_empty($$ update public.applications set status = 'rejected' where id = '60000000-0000-0000-0000-0000000000b1' returning id $$, 'admin cannot review an org B application');
select is_empty($$ update public.volunteers set phone = '000' where id = '30000000-0000-0000-0000-0000000000b1' returning id $$, 'admin cannot edit an org B volunteer');
select is_empty($$ update public.users set first_name = 'x' where id = '20000000-0000-0000-0000-0000000000b1' returning id $$, 'admin cannot edit an org B user');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000b1') $$, '42501', null, 'admin cannot register an org B volunteer');
select is_empty($$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-0000000000b1' returning id $$, 'admin cannot change org B registrations');
select lives_ok($$ update public.organizations set name = 'Org A renamed', primary_color = '#112233' where id = '10000000-0000-0000-0000-00000000000a' $$, 'admin can edit their org');
select is_empty($$ update public.organizations set name = 'x' where id = '10000000-0000-0000-0000-00000000000b' returning id $$, 'admin cannot edit org B');
select lives_ok($$ update public.registrations set attendance_status = 'no_show' where id = '50000000-0000-0000-0000-0000000000a3' $$, 'admin can correct attendance');
select throws_ok($$ update public.registrations set attendance_status = null where id = '50000000-0000-0000-0000-0000000000a3' $$, '42501', 'Recorded attendance can be corrected but not cleared',
  'admin cannot clear recorded attendance');
select throws_ok($$ update public.events set status = 'published' where id = '40000000-0000-0000-0000-0000000000a3' $$, '42501', 'A completed event cannot be reopened',
  'staff cannot reopen a completed event');
select lives_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'registration', 'Shirt size', 'select') $$, 'admin can add a custom field');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000b', 'registration', 'x', 'text') $$, '42501', null, 'admin cannot add an org B custom field');
reset role;

-- Manager, org A -------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select set_eq('select user_id from public.volunteers', $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4') $$, 'manager sees every org A volunteer');
select results_eq($$ update public.applications set status = 'rejected', applicant_message = 'No availability'
  where volunteer_id = '30000000-0000-0000-0000-0000000000a3' and status = 'pending' returning reviewed_by, applicant_message $$,
  $$ values ('20000000-0000-0000-0000-0000000000a5'::uuid, 'No availability') $$, 'manager can review applications; a written message replaces the default');
select is_empty('select * from public.application_notes', 'managers cannot read internal notes');
select throws_ok($$ insert into public.application_notes (application_id, internal_note) select id, 'x' from public.applications where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4') $$,
  '42501', null, 'managers cannot write internal notes');
select lives_ok($$ insert into public.events (organization_id, title, starts_at, ends_at) values ('10000000-0000-0000-0000-00000000000a', 'Manager event', now(), now() + interval '1 hour') $$, 'manager can create events');
select throws_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a1', 'admin') $$, '42501', 'Only admins can change roles', 'manager cannot change roles');
select lives_ok($$ insert into public.volunteers (user_id) values ('20000000-0000-0000-0000-0000000000a5') $$, 'manager can also have a volunteer profile');
select lives_ok($$ insert into public.applications (volunteer_id) select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a5' $$, 'manager can apply as a volunteer');
select is_empty($$ update public.applications set status = 'approved' where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a5') returning id $$, 'staff cannot approve their own application');
select is_empty($$ update public.organizations set name = 'x' returning id $$, 'manager cannot edit org settings');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'application', 'x', 'text') $$, '42501', null, 'manager cannot add custom fields');
reset role;

-- Once approved, the formerly pending volunteer can register -------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select lives_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2') $$, 'volunteer can register once approved');
reset role;

-- Admin, org B ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000b0", "role": "authenticated"}';
select results_eq('select id from public.events', $$ values ('40000000-0000-0000-0000-0000000000b1'::uuid) $$, 'org B admin sees only org B events');
select results_eq('select id from public.registrations', $$ values ('50000000-0000-0000-0000-0000000000b1'::uuid) $$, 'org B admin sees only org B registrations');
select results_eq('select internal_note from public.application_notes', $$ values ('Org B note.') $$, 'org B admin sees only org B notes');
reset role;

-- Cancelled events and lost approval ---------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ update public.events set status = 'cancelled' where id = '40000000-0000-0000-0000-0000000000a1' $$, 'admin can cancel an event');
select lives_ok($$ update public.applications set status = 'rejected' where id = '60000000-0000-0000-0000-0000000000a2' $$, 'admin can revoke an approval');
select is((select applicant_message from public.applications where id = '60000000-0000-0000-0000-0000000000a2'),
  'Thanks for applying. We are not able to take you on right now.', 'a rejection with no message gets the org default');
select results_eq($$ update public.applications set status = 'rejected', applicant_message = '  ' where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4') returning applicant_message $$,
  $$ values ('Thanks for applying. We are not able to take you on right now.') $$, 'a rejection with a blank message gets the org default');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select results_eq($$ select status::text from public.events where id = '40000000-0000-0000-0000-0000000000a1' $$, $$ values ('cancelled') $$, 'volunteer still sees a cancelled event they registered for');
select isnt_empty($$ select id from public.registrations where event_id = '40000000-0000-0000-0000-0000000000a1' $$, 'volunteer still sees that registration');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select results_eq($$ update public.registrations set status = 'cancelled' where event_id = '40000000-0000-0000-0000-0000000000a1' returning status::text $$, $$ values ('cancelled') $$, 'volunteer can cancel after losing approval');
select throws_ok($$ update public.registrations set status = 'registered' where event_id = '40000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot re-register without approval');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select is_empty($$ select id from public.events where status <> 'published' $$, 'volunteers see no drafts or past events they did not register for');
reset role;

-- Capacity, deadlines, and deleting ------------------------------------------------------------

insert into public.events (id, organization_id, status, title, starts_at, ends_at, capacity, registration_deadline) values
  ('40000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-00000000000a', 'published', 'A one spot', now() + interval '1 day', now() + interval '1 day 2 hours', 1, null),
  ('40000000-0000-0000-0000-0000000000a7', '10000000-0000-0000-0000-00000000000a', 'published', 'A deadline passed', now() + interval '1 day', now() + interval '1 day 2 hours', null, now() - interval '1 hour');
insert into public.events (id, organization_id, status, title, starts_at, ends_at) values
  ('40000000-0000-0000-0000-0000000000a8', '10000000-0000-0000-0000-00000000000a', 'draft', 'A draft with a registration', now() + interval '5 days', now() + interval '5 days 1 hour');
insert into public.registrations (event_id, volunteer_id, status) values
  ('40000000-0000-0000-0000-0000000000a7', '30000000-0000-0000-0000-0000000000a1', 'cancelled'),
  ('40000000-0000-0000-0000-0000000000a3', '30000000-0000-0000-0000-0000000000a2', 'cancelled'),
  ('40000000-0000-0000-0000-0000000000a3', '30000000-0000-0000-0000-0000000000a3', 'registered'),
  ('40000000-0000-0000-0000-0000000000a8', '30000000-0000-0000-0000-0000000000a1', 'registered');

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a6', '30000000-0000-0000-0000-0000000000a1') $$, 'volunteer can take the last spot');
select throws_ok($$ update public.registrations set status = 'registered' where event_id = '40000000-0000-0000-0000-0000000000a7' $$, '42501', null, 'volunteer cannot re-register after the deadline');
select is_empty($$ select id from public.events where id = '40000000-0000-0000-0000-0000000000a8' $$, 'volunteers do not see drafts, even ones they are registered for');
select is(public.registration_count(jsonb_populate_record(null::public.events, '{"id": "40000000-0000-0000-0000-0000000000a8"}')), null, 'or their counts');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select throws_ok($$ update public.registrations set status = 'cancelled' where event_id = '40000000-0000-0000-0000-0000000000a3' $$, '42501', null, 'volunteer cannot cancel after the event is completed');
select results_eq($$ select public.registration_count(e) from public.events e where e.id = '40000000-0000-0000-0000-0000000000a6' $$, $$ values (1) $$, 'members see how many spots are taken');
select is_empty($$ select 1 from public.registrations where event_id = '40000000-0000-0000-0000-0000000000a6' $$, 'but not who took them');
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a6', '30000000-0000-0000-0000-0000000000a3') $$, '42501', null, 'access rules run before the capacity check, so it reveals nothing');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000b0", "role": "authenticated"}';
select is_empty($$ select public.registration_count(e) from public.events e where e.id = '40000000-0000-0000-0000-0000000000a6' $$, 'org B cannot see org A events or their counts');
select is(public.registration_count(jsonb_populate_record(null::public.events, '{"id": "40000000-0000-0000-0000-0000000000a6"}')), null, 'the count answers only for events the caller can see');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select throws_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a6', '30000000-0000-0000-0000-0000000000a2') $$, '23514', 'This event is full', 'staff cannot overfill an event either');
select lives_ok($$ update public.registrations set status = 'registered' where event_id = '40000000-0000-0000-0000-0000000000a6' $$, 'saving an existing registration does not count it twice');

insert into public.registrations (event_id, volunteer_id) values
  ('40000000-0000-0000-0000-0000000000a5', '30000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-0000000000a5', '30000000-0000-0000-0000-0000000000a3');
update public.events set capacity = 1 where id = '40000000-0000-0000-0000-0000000000a5';
select lives_ok($$ update public.registrations set status = 'registered' where event_id = '40000000-0000-0000-0000-0000000000a5' $$, 'lowering capacity does not block edits to existing registrations');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$ update public.registrations set status = 'cancelled' where event_id = '40000000-0000-0000-0000-0000000000a6' $$, 'volunteer can give up their spot');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a6', '30000000-0000-0000-0000-0000000000a2') $$, 'a freed spot can be taken');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$ update public.registrations set status = 'registered' where event_id = '40000000-0000-0000-0000-0000000000a6' $$, '23514', 'This event is full', 'volunteer cannot re-register into a full event');
reset role;

select throws_ok($$ update public.registrations set event_id = '40000000-0000-0000-0000-0000000000a6' where id = '50000000-0000-0000-0000-0000000000b1' $$, '23514', 'This event is full', 'moving a registration into a full event is refused');

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select throws_ok($$ delete from public.events where id = '40000000-0000-0000-0000-0000000000a3' $$, '23503', 'This event has registrations; cancel it instead', 'staff cannot delete an event with registrations');
select throws_ok($$ delete from public.events where id = '40000000-0000-0000-0000-0000000000a7' $$, '23503', null, 'cancelled registrations still block deleting the event');
select results_eq($$ delete from public.events where id = '40000000-0000-0000-0000-0000000000a2' returning id $$, $$ values ('40000000-0000-0000-0000-0000000000a2'::uuid) $$, 'staff can delete an event nobody registered for');
select results_eq($$ delete from public.registrations where event_id = '40000000-0000-0000-0000-0000000000a1' and volunteer_id = '30000000-0000-0000-0000-0000000000a2' returning volunteer_id $$,
  $$ values ('30000000-0000-0000-0000-0000000000a2'::uuid) $$, 'staff can delete a registration without attendance');
select is_empty($$ delete from public.registrations where id = '50000000-0000-0000-0000-0000000000a3' returning id $$, 'staff cannot delete a registration once attendance is recorded');
select is_empty($$ delete from public.registrations where event_id = '40000000-0000-0000-0000-0000000000a3' and volunteer_id = '30000000-0000-0000-0000-0000000000a2' returning id $$,
  'staff cannot delete a registration for a completed event');

select lives_ok($$ insert into public.volunteers (user_id) values ('20000000-0000-0000-0000-0000000000a0') $$, 'admin can also have a volunteer profile');
select lives_ok($$ insert into public.applications (volunteer_id) select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a0' $$, 'admin can apply as a volunteer');
select throws_ok($$ insert into public.application_notes (application_id, internal_note) select id, 'x' from public.applications where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a0') $$,
  '42501', null, 'admins cannot write notes on their own application');
reset role;

-- Server-side changes ----------------------------------------------------------------------------

update public.organizations set default_rejection_message = 'Org B default.' where id = '10000000-0000-0000-0000-00000000000b';
update public.applications set status = 'rejected' where id = '60000000-0000-0000-0000-0000000000b1';
select is((select applicant_message from public.applications where id = '60000000-0000-0000-0000-0000000000b1'), 'Org B default.', 'server-side rejections get the default too');

delete from public.applications where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4' and organization_id = '10000000-0000-0000-0000-00000000000a');
select is((select status::text from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4' and organization_id = '10000000-0000-0000-0000-00000000000a'), 'pending', 'deleting the latest application resyncs the volunteer status');

insert into public.volunteers (id, user_id) values ('30000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f1');
insert into public.applications (volunteer_id, status) values ('30000000-0000-0000-0000-0000000000f1', 'approved');
insert into public.memberships (user_id, organization_id) values ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000b');
select results_eq($$ select organization_id, status::text from public.volunteers where id = '30000000-0000-0000-0000-0000000000f1' $$, $$ values (null::uuid, 'approved') $$,
  'a used profile does not carry its approval into a new organization');
insert into public.volunteers (id, user_id) values ('30000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f1');
select is((select organization_id from public.volunteers where id = '30000000-0000-0000-0000-0000000000f2'), '10000000-0000-0000-0000-00000000000b'::uuid,
  'a server-side profile gets its owner''s organization');
delete from public.memberships where user_id = '20000000-0000-0000-0000-0000000000f1';
insert into public.memberships (user_id, organization_id) values ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000a');
select is((select organization_id from public.volunteers where id = '30000000-0000-0000-0000-0000000000f2'), '10000000-0000-0000-0000-00000000000b'::uuid,
  'a profile stays with its organization when its owner moves');

select lives_ok($$ delete from public.organizations where id = '10000000-0000-0000-0000-00000000000a' $$, 'deleting an organization still works');
select is((select count(*) from public.registrations r join public.events e on e.id = r.event_id where e.organization_id = '10000000-0000-0000-0000-00000000000a'), 0::bigint,
  'and removes its events and registrations');

select * from finish();
rollback;
