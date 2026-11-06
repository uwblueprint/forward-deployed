-- Access-control tests. Run: npx supabase test db (needs npx supabase start).
-- Runs in one transaction and rolls back.
-- ID prefixes: 1 org, 2 user, 3 volunteer, 4 event, 5 registration, 6 application, 7 custom field.
-- Suffix a/b = org A or B. Users: a0 admin, a1 approved, a2 pending, a3 rejected,
-- a4 no profile yet, a5 manager, b0 admin, b1 approved, f0 fresh signup.

begin;
create extension if not exists pgtap with schema extensions;
select plan(113);

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

update public.users set organization_id = '10000000-0000-0000-0000-00000000000a' where id::text like '20000000-0000-0000-0000-0000000000a_';
update public.users set organization_id = '10000000-0000-0000-0000-00000000000b' where id::text like '20000000-0000-0000-0000-0000000000b_';
update public.users set role = 'admin' where id in ('20000000-0000-0000-0000-0000000000a0', '20000000-0000-0000-0000-0000000000b0');
update public.users set role = 'manager' where id = '20000000-0000-0000-0000-0000000000a5';

insert into public.volunteers (id, user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2'),
  ('30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000a3'),
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1');

insert into public.applications (id, volunteer_id, status) values
  ('60000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1', 'approved'),
  ('60000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a2', 'pending'),
  ('60000000-0000-0000-0000-0000000000a3', '30000000-0000-0000-0000-0000000000a3', 'rejected'),
  ('60000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1', 'approved');

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
select is((select string_agg(p.proname::text, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  'set_user_role', 'set_user_role is the only function in the API schema');
select results_eq($$ select status::text from public.volunteers where id::text like '30000000-0000-0000-0000-0000000000a_' order by id $$,
  $$ values ('approved'), ('pending'), ('rejected') $$,
  'volunteer status mirrors their latest application');

insert into auth.users (id, email, raw_user_meta_data) values ('20000000-0000-0000-0000-0000000000f0', 'signup@example.com',
  '{"full_name": "Sam Signup", "role": "admin", "organization_id": "10000000-0000-0000-0000-00000000000a"}');
select results_eq($$ select role::text, organization_id, first_name, last_name, email from public.users where id = '20000000-0000-0000-0000-0000000000f0' $$,
  $$ values ('volunteer', null::uuid, 'Sam', 'Signup', 'signup@example.com') $$,
  'signup creates a volunteer with no org and splits the name, ignoring role/org metadata');

update auth.users set email = 'renamed@example.com' where id = '20000000-0000-0000-0000-0000000000f0';
select is((select email from public.users where id = '20000000-0000-0000-0000-0000000000f0'), 'renamed@example.com',
  'email changes are mirrored to public.users');

-- Logged out -------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok('select * from public.organizations', '42501', null, 'anon cannot read organizations');
select throws_ok('select * from public.users', '42501', null, 'anon cannot read users');
select throws_ok('select * from public.volunteers', '42501', null, 'anon cannot read volunteers');
select throws_ok('select * from public.applications', '42501', null, 'anon cannot read applications');
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
select results_eq('select id from public.volunteers', $$ values ('30000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their profile');
select results_eq('select id from public.applications', $$ values ('60000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their applications');
select set_eq('select id from public.events', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a3'), ('40000000-0000-0000-0000-0000000000a5') $$,
  'volunteer sees published events plus past events they registered for, in their org only');
select results_eq('select id from public.registrations', $$ values ('50000000-0000-0000-0000-0000000000a3'::uuid) $$, 'volunteer sees only their registrations');
select results_eq('select id from public.custom_fields', $$ values ('70000000-0000-0000-0000-0000000000a1'::uuid) $$, 'volunteer sees only their org''s custom fields');

select lives_ok($$ update public.users set first_name = 'New' where id = '20000000-0000-0000-0000-0000000000a1' $$, 'volunteer can edit their name');
select throws_ok($$ update public.users set role = 'admin' where id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot change their role');
select throws_ok($$ update public.users set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot change their org');
select throws_ok($$ update public.users set email = 'x@example.com' where id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot edit the email mirror');
select throws_ok($$ update public.volunteers set status = 'approved' where id = '30000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot set their status');
select lives_ok($$ update public.volunteers set phone = '519-555-0100', shift_preference = 'evening' where id = '30000000-0000-0000-0000-0000000000a1' $$, 'volunteer can edit their profile');
select lives_ok($$ update public.volunteers set consent_accepted_at = '2000-01-01' where id = '30000000-0000-0000-0000-0000000000a1' $$, 'volunteer can record consent');
select is((select consent_accepted_at from public.volunteers where id = '30000000-0000-0000-0000-0000000000a1'), now(), 'the database sets the consent time');
select is_empty($$ update public.volunteers set phone = '000' where id = '30000000-0000-0000-0000-0000000000a2' returning id $$, 'volunteer cannot edit another profile');
select is_empty($$ update public.applications set status = 'approved' where id = '60000000-0000-0000-0000-0000000000a1' returning id $$, 'volunteer cannot review their application');
select throws_ok($$ insert into public.applications (volunteer_id) values ('30000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'approved volunteer cannot apply again');

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
select lives_ok($$ insert into public.applications (volunteer_id, responses) values ('30000000-0000-0000-0000-0000000000a3', '{"70000000-0000-0000-0000-0000000000a1": "Second try"}') $$, 'rejected volunteer can reapply');
select is((select status::text from public.volunteers where id = '30000000-0000-0000-0000-0000000000a3'), 'pending', 'reapplying puts the volunteer back to pending');
reset role;

-- New user in org A creating a profile and applying -----------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';
select throws_ok($$ insert into public.volunteers (user_id, status) values ('20000000-0000-0000-0000-0000000000a4', 'approved') $$, '42501', null, 'new volunteer cannot self-approve');
select throws_ok($$ insert into public.volunteers (user_id) values ('20000000-0000-0000-0000-0000000000a0') $$, '42501', null, 'new volunteer cannot create a profile for someone else');
select lives_ok($$ insert into public.volunteers (user_id, availability_days, shift_preference, consent_accepted_at) values ('20000000-0000-0000-0000-0000000000a4', '{monday,friday}', 'morning', '2000-01-01') $$, 'new volunteer can create their profile');
select results_eq($$ select status::text, consent_accepted_at = now() from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4' $$, $$ values ('pending', true) $$, 'new profile is pending, with a database-set consent time');
select lives_ok($$ insert into public.applications (volunteer_id, responses) select id, '{}'::jsonb from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4' $$, 'new volunteer can apply');
reset role;

-- Signed-in user with no organization -------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000f0", "role": "authenticated"}';
select is_empty('select id from public.organizations', 'no-org user sees no organizations');
select is_empty('select id from public.events', 'no-org user sees no events');
select is_empty('select id from public.custom_fields', 'no-org user sees no custom fields');
reset role;

-- Admin, org A --------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';

select results_eq('select id from public.organizations', $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$, 'admin sees only their org');
select set_eq('select id from public.users', $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid), ('20000000-0000-0000-0000-0000000000a1'), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4'), ('20000000-0000-0000-0000-0000000000a5') $$, 'admin sees every org A user and nobody else');
select set_eq('select user_id from public.volunteers', $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4') $$, 'admin sees every org A volunteer and none in org B');
select set_eq('select id from public.events', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a2'),
  ('40000000-0000-0000-0000-0000000000a3'), ('40000000-0000-0000-0000-0000000000a4'), ('40000000-0000-0000-0000-0000000000a5') $$, 'admin sees every org A event and none in org B');
select set_eq('select event_id from public.registrations', $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a3') $$, 'admin sees org A registrations only');
select is_empty($$ select id from public.applications where volunteer_id = '30000000-0000-0000-0000-0000000000b1' $$, 'admin cannot see org B applications');

select results_eq($$ update public.applications set status = 'approved' where id = '60000000-0000-0000-0000-0000000000a2' returning reviewed_by, reviewed_at = now() $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid, true) $$, 'admin can approve; the database records who and when');
select is((select status::text from public.volunteers where id = '30000000-0000-0000-0000-0000000000a2'), 'approved', 'approval updates the volunteer status');
select lives_ok($$ update public.applications set status = 'approved', rejection_reason = 'leftover' where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4') $$, 'admin can approve a new application');
select is((select rejection_reason from public.applications where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4')), null, 'approving clears any rejection reason');
select lives_ok($$ update public.volunteers set phone = '519-555-0199', skills = '{Driving}' where id = '30000000-0000-0000-0000-0000000000a2' $$, 'admin can edit a volunteer profile');
select throws_ok($$ update public.volunteers set consent_accepted_at = now() where id = '30000000-0000-0000-0000-0000000000a2' $$, '42501', 'Only the volunteer can record their own consent', 'admin cannot record consent for a volunteer');
select lives_ok($$ update public.volunteers set consent_accepted_at = '2001-01-01', phone = '519-555-0123' where id = '30000000-0000-0000-0000-0000000000a1' $$, 'admin can save a whole profile back');
select is((select consent_accepted_at from public.volunteers where id = '30000000-0000-0000-0000-0000000000a1'), now(), 'saving a profile back keeps the original consent time');
select throws_ok($$ update public.users set role = 'manager' where id = '20000000-0000-0000-0000-0000000000a4' $$, '42501', null, 'role is not writable directly, even by admins');
select throws_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a0', 'volunteer') $$, '42501', 'You cannot change your own role', 'admin cannot change their own role');
select throws_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000b1', 'admin') $$, '42501', 'User not found in your organization', 'admin cannot change an org B user''s role');
select lives_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a4', 'manager') $$, 'admin can change another user''s role');
select is((select role::text from public.users where id = '20000000-0000-0000-0000-0000000000a4'), 'manager', 'the role change is saved');
select lives_ok($$ update public.users set last_name = 'Edited' where id = '20000000-0000-0000-0000-0000000000a1' $$, 'admin can edit a user''s name');
select throws_ok($$ update public.users set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'admin cannot move a user to another org');

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
select lives_ok($$ update public.registrations set attendance_status = 'no_show' where id = '50000000-0000-0000-0000-0000000000a3' $$, 'admin can record attendance');
select lives_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000a', 'registration', 'Shirt size', 'select') $$, 'admin can add a custom field');
select throws_ok($$ insert into public.custom_fields (organization_id, entity_type, field_name, field_type) values ('10000000-0000-0000-0000-00000000000b', 'registration', 'x', 'text') $$, '42501', null, 'admin cannot add an org B custom field');
reset role;

-- Manager, org A -------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select set_eq('select user_id from public.volunteers', $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid), ('20000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4') $$, 'manager sees every org A volunteer');
select results_eq($$ update public.applications set status = 'rejected', rejection_reason = 'No availability'
  where volunteer_id = '30000000-0000-0000-0000-0000000000a3' and status = 'pending' returning reviewed_by $$,
  $$ values ('20000000-0000-0000-0000-0000000000a5'::uuid) $$, 'manager can review applications');
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
reset role;

-- Cancelled events and lost approval ---------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ update public.events set status = 'cancelled' where id = '40000000-0000-0000-0000-0000000000a1' $$, 'admin can cancel an event');
select lives_ok($$ update public.applications set status = 'rejected' where id = '60000000-0000-0000-0000-0000000000a2' $$, 'admin can revoke an approval');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select results_eq($$ select status::text from public.events where id = '40000000-0000-0000-0000-0000000000a1' $$, $$ values ('cancelled') $$, 'volunteer still sees a cancelled event they registered for');
select isnt_empty($$ select id from public.registrations where event_id = '40000000-0000-0000-0000-0000000000a1' $$, 'volunteer still sees that registration');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';
select results_eq($$ update public.registrations set status = 'cancelled' where event_id = '40000000-0000-0000-0000-0000000000a1' returning status::text $$, $$ values ('cancelled') $$, 'volunteer can cancel after losing approval');
select throws_ok($$ update public.registrations set status = 'registered' where event_id = '40000000-0000-0000-0000-0000000000a1' $$, '42501', null, 'volunteer cannot re-register without approval');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';
select is_empty($$ select id from public.events where status <> 'published' $$, 'volunteers see no drafts or past events they did not register for');
reset role;

delete from public.applications where volunteer_id = (select id from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4');
select is((select status::text from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4'), 'pending', 'deleting the latest application resyncs the volunteer status');

select * from finish();
rollback;
