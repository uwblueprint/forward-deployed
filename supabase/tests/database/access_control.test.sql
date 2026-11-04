-- Access-control tests for FOR-23. Run with: npx supabase test db
-- Needs the local stack (npx supabase start). Everything runs inside one
-- transaction and is rolled back, so it never leaves data behind.
--
-- Fixed IDs, by first digit: 1 = organization, 2 = user, 3 = volunteer row,
-- 4 = event, 5 = registration. The last two characters say which org (a/b)
-- and which person or event.

begin;
create extension if not exists pgtap with schema extensions;
select plan(69);

-------------------------------------------------------------------------------
-- Fixtures (as postgres, so RLS does not apply)
-------------------------------------------------------------------------------

insert into public.organizations (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Org A'),
  ('10000000-0000-0000-0000-00000000000b', 'Org B');

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-0000000000a0', 'admin.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a1', 'approved.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a2', 'pending.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a3', 'rejected.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a4', 'new.a@example.com'),
  ('20000000-0000-0000-0000-0000000000b0', 'admin.b@example.com'),
  ('20000000-0000-0000-0000-0000000000b1', 'approved.b@example.com');

update public.users set organization_id = '10000000-0000-0000-0000-00000000000a'
  where id::text like '20000000-0000-0000-0000-0000000000a_';
update public.users set organization_id = '10000000-0000-0000-0000-00000000000b'
  where id::text like '20000000-0000-0000-0000-0000000000b_';
update public.users set role = 'admin'
  where id in ('20000000-0000-0000-0000-0000000000a0', '20000000-0000-0000-0000-0000000000b0');

insert into public.volunteers (id, user_id, status) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', 'approved'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2', 'pending'),
  ('30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000a3', 'rejected'),
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', 'approved');

insert into public.events (id, organization_id, status, title, starts_at, ends_at) values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'published', 'A published', now() + interval '1 day', now() + interval '1 day 2 hours'),
  ('40000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'draft',     'A draft',     now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'completed', 'A completed', now() - interval '7 days', now() - interval '7 days' + interval '2 hours'),
  ('40000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-00000000000a', 'cancelled', 'A cancelled', now() + interval '3 days', now() + interval '3 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'published', 'B published', now() + interval '1 day', now() + interval '1 day 2 hours');

insert into public.registrations (id, event_id, volunteer_id) values
  ('50000000-0000-0000-0000-0000000000a3', '40000000-0000-0000-0000-0000000000a3', '30000000-0000-0000-0000-0000000000a1'),
  ('50000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1');

-------------------------------------------------------------------------------
-- Schema-level checks
-------------------------------------------------------------------------------

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'RLS is enabled on every public table'
);

-- Signup trigger ignores role and organization in client-supplied metadata.
insert into auth.users (id, email, raw_user_meta_data) values (
  '20000000-0000-0000-0000-0000000000f0',
  'signup@example.com',
  '{"full_name": "Sam Signup", "role": "admin", "organization_id": "10000000-0000-0000-0000-00000000000a"}'
);

select results_eq(
  $$ select role::text, organization_id, full_name, email from public.users
     where id = '20000000-0000-0000-0000-0000000000f0' $$,
  $$ values ('volunteer', null::uuid, 'Sam Signup', 'signup@example.com') $$,
  'signup creates a volunteer with no organization, ignoring role/org metadata'
);

update auth.users set email = 'renamed@example.com' where id = '20000000-0000-0000-0000-0000000000f0';
select is(
  (select email from public.users where id = '20000000-0000-0000-0000-0000000000f0'),
  'renamed@example.com',
  'email changes in auth.users are mirrored to public.users'
);

-------------------------------------------------------------------------------
-- Logged out (anon)
-------------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok('select * from public.organizations', '42501', null, 'anon cannot read organizations');
select throws_ok('select * from public.users',         '42501', null, 'anon cannot read users');
select throws_ok('select * from public.volunteers',    '42501', null, 'anon cannot read volunteers');
select throws_ok('select * from public.events',        '42501', null, 'anon cannot read events');
select throws_ok('select * from public.registrations', '42501', null, 'anon cannot read registrations');
select throws_ok('select public.is_admin()',           '42501', null, 'anon cannot call helper functions');

reset role;

-------------------------------------------------------------------------------
-- Approved volunteer in org A
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq('select id from public.organizations',
  $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$,
  'volunteer sees only their own organization');
select results_eq('select id from public.users',
  $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'volunteer sees only their own user row');
select results_eq('select id from public.volunteers',
  $$ values ('30000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'volunteer sees only their own volunteer profile, not org A or org B peers');
select set_eq('select id from public.events',
  $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a3') $$,
  'volunteer sees published events plus past events they registered for, in their org only');
select results_eq('select id from public.registrations',
  $$ values ('50000000-0000-0000-0000-0000000000a3'::uuid) $$,
  'volunteer sees their own registrations, including for a completed event, and none from org B');

select lives_ok(
  $$ update public.users set full_name = 'New Name' where id = '20000000-0000-0000-0000-0000000000a1' $$,
  'volunteer can update their own full_name');
select throws_ok(
  $$ update public.users set role = 'admin' where id = '20000000-0000-0000-0000-0000000000a1' $$,
  '42501', 'You cannot change your own role',
  'volunteer cannot change their own role');
select throws_ok(
  $$ update public.users set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'volunteer cannot change their own organization');
select throws_ok(
  $$ update public.users set email = 'x@example.com' where id = '20000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'volunteer cannot edit the email mirror');
select throws_ok(
  $$ update public.volunteers set status = 'pending' where user_id = '20000000-0000-0000-0000-0000000000a1' $$,
  '42501', 'You cannot change your own review status',
  'volunteer cannot change their own status');
select lives_ok(
  $$ update public.volunteers set phone = '519-555-0100', shift_preference = 'evening' where user_id = '20000000-0000-0000-0000-0000000000a1' $$,
  'volunteer can update their own profile fields');
select is_empty(
  $$ update public.volunteers set phone = '000' where id = '30000000-0000-0000-0000-0000000000a2' returning id $$,
  'volunteer cannot update another volunteer''s profile');

select lives_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1') $$,
  'approved volunteer can register for a published event in their org');
select throws_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'volunteer cannot register for a draft event');
select throws_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'volunteer cannot register for an org B event');
select throws_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3') $$,
  '42501', null,
  'volunteer cannot register someone else');
select results_eq(
  $$ update public.registrations set status = 'cancelled'
     where event_id = '40000000-0000-0000-0000-0000000000a1' returning status::text $$,
  $$ values ('cancelled') $$,
  'volunteer can cancel their own registration');
select is_empty(
  $$ delete from public.registrations returning id $$,
  'volunteer cannot delete registrations');
select throws_ok(
  $$ insert into public.events (organization_id, title, starts_at, ends_at)
     values ('10000000-0000-0000-0000-00000000000a', 'x', now(), now() + interval '1 hour') $$,
  '42501', null,
  'volunteer cannot create events');
select is_empty(
  $$ update public.organizations set name = 'x' returning id $$,
  'volunteer cannot rename their organization');

reset role;

-------------------------------------------------------------------------------
-- Pending and rejected volunteers in org A
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';

select results_eq('select id from public.events',
  $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'pending volunteer can browse published events in their org');
select throws_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2') $$,
  '42501', null,
  'pending volunteer cannot register');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3') $$,
  '42501', null,
  'rejected volunteer cannot register');

reset role;

-------------------------------------------------------------------------------
-- New user in org A creating their volunteer profile
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a4", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.volunteers (user_id, status) values ('20000000-0000-0000-0000-0000000000a4', 'approved') $$,
  '42501', null,
  'new volunteer cannot self-approve on insert');
select throws_ok(
  $$ insert into public.volunteers (user_id) values ('20000000-0000-0000-0000-0000000000a0') $$,
  '42501', null,
  'new volunteer cannot create a profile for someone else');
select lives_ok(
  $$ insert into public.volunteers (user_id, availability_days, shift_preference)
     values ('20000000-0000-0000-0000-0000000000a4', '{monday,friday}', 'morning') $$,
  'new volunteer can create their own profile');
select is(
  (select status::text from public.volunteers where user_id = '20000000-0000-0000-0000-0000000000a4'),
  'pending',
  'a new profile starts as pending');

reset role;

-------------------------------------------------------------------------------
-- Signed-in user with no organization
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000f0", "role": "authenticated"}';

select is_empty('select id from public.organizations', 'user without an org sees no organizations');
select is_empty('select id from public.events',        'user without an org sees no events');

reset role;

-------------------------------------------------------------------------------
-- Admin in org A
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';

select results_eq('select id from public.organizations',
  $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$,
  'admin sees only their own organization');
select set_eq('select id from public.users',
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid), ('20000000-0000-0000-0000-0000000000a1'),
            ('20000000-0000-0000-0000-0000000000a2'), ('20000000-0000-0000-0000-0000000000a3'),
            ('20000000-0000-0000-0000-0000000000a4') $$,
  'admin sees every user in org A and nobody else');
select set_eq('select user_id from public.volunteers',
  $$ values ('20000000-0000-0000-0000-0000000000a1'::uuid), ('20000000-0000-0000-0000-0000000000a2'),
            ('20000000-0000-0000-0000-0000000000a3'), ('20000000-0000-0000-0000-0000000000a4') $$,
  'admin sees every volunteer in org A and none in org B');
select set_eq('select id from public.events',
  $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a2'),
            ('40000000-0000-0000-0000-0000000000a3'), ('40000000-0000-0000-0000-0000000000a4') $$,
  'admin sees every event in org A, whatever its status, and none in org B');
select set_eq('select event_id from public.registrations',
  $$ values ('40000000-0000-0000-0000-0000000000a1'::uuid), ('40000000-0000-0000-0000-0000000000a3') $$,
  'admin sees org A registrations only');

select lives_ok(
  $$ update public.volunteers set status = 'approved', reviewed_at = now()
     where id = '30000000-0000-0000-0000-0000000000a2' $$,
  'admin can approve a volunteer in their org');
select is(
  (select status::text from public.volunteers where id = '30000000-0000-0000-0000-0000000000a2'),
  'approved',
  'approval is saved');
select results_eq(
  $$ update public.volunteers set phone = '519-555-0199', skills = '{Driving}'
     where id = '30000000-0000-0000-0000-0000000000a2' returning phone $$,
  $$ values ('519-555-0199') $$,
  'admin can edit a volunteer''s profile in their org');
select throws_ok(
  $$ update public.volunteers set consent_accepted_at = now() where id = '30000000-0000-0000-0000-0000000000a2' $$,
  '42501', 'Only the volunteer can record their own consent',
  'admin cannot record consent for a volunteer');
select throws_ok(
  $$ update public.users set role = 'volunteer' where id = '20000000-0000-0000-0000-0000000000a0' $$,
  '42501', 'You cannot change your own role',
  'admin cannot change their own role');
select results_eq(
  $$ update public.users set role = 'admin' where id = '20000000-0000-0000-0000-0000000000a4' returning role::text $$,
  $$ values ('admin') $$,
  'admin can change another org A user''s role');
select results_eq(
  $$ update public.users set full_name = 'Edited By Admin' where id = '20000000-0000-0000-0000-0000000000a1' returning full_name $$,
  $$ values ('Edited By Admin') $$,
  'admin can edit the name of a user in their org');
select throws_ok(
  $$ update public.users set organization_id = '10000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'admin cannot move a user to another organization');

select lives_ok(
  $$ insert into public.events (organization_id, title, starts_at, ends_at)
     values ('10000000-0000-0000-0000-00000000000a', 'New A event', now(), now() + interval '1 hour') $$,
  'admin can create an event in their org');
select throws_ok(
  $$ insert into public.events (organization_id, title, starts_at, ends_at)
     values ('10000000-0000-0000-0000-00000000000b', 'Sneaky', now(), now() + interval '1 hour') $$,
  '42501', null,
  'admin cannot create an event in org B');
select is_empty(
  $$ update public.events set title = 'x' where id = '40000000-0000-0000-0000-0000000000b1' returning id $$,
  'admin cannot edit an org B event');
select is_empty(
  $$ delete from public.events where id = '40000000-0000-0000-0000-0000000000b1' returning id $$,
  'admin cannot delete an org B event');
select is_empty(
  $$ update public.volunteers set status = 'rejected' where id = '30000000-0000-0000-0000-0000000000b1' returning id $$,
  'admin cannot review an org B volunteer');
select is_empty(
  $$ update public.volunteers set phone = '000' where id = '30000000-0000-0000-0000-0000000000b1' returning id $$,
  'admin cannot edit an org B volunteer''s profile');
select is_empty(
  $$ update public.users set full_name = 'x' where id = '20000000-0000-0000-0000-0000000000b1' returning id $$,
  'admin cannot edit an org B user''s name');
select throws_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'admin cannot register an org B volunteer for an org A event');
select is_empty(
  $$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-0000000000b1' returning id $$,
  'admin cannot change org B registrations');
select lives_ok(
  $$ update public.organizations set name = 'Org A renamed' where id = '10000000-0000-0000-0000-00000000000a' $$,
  'admin can rename their own organization');
select is_empty(
  $$ update public.organizations set name = 'x' where id = '10000000-0000-0000-0000-00000000000b' returning id $$,
  'admin cannot rename org B');

reset role;

-------------------------------------------------------------------------------
-- After approval, the formerly pending volunteer can register
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a2", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.registrations (event_id, volunteer_id) values ('40000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a2') $$,
  'a volunteer can register once an admin approves them');

reset role;

-------------------------------------------------------------------------------
-- Admin in org B cannot see org A
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000b0", "role": "authenticated"}';

select results_eq('select id from public.events',
  $$ values ('40000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'org B admin sees only org B events');
select results_eq('select id from public.registrations',
  $$ values ('50000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'org B admin sees only org B registrations');

reset role;

-------------------------------------------------------------------------------
-- A cancelled event stays visible to the volunteers who registered for it
-------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';

select lives_ok(
  $$ update public.events set status = 'cancelled' where id = '40000000-0000-0000-0000-0000000000a1' $$,
  'admin can cancel an event');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$ select status::text from public.events where id = '40000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('cancelled') $$,
  'volunteer still sees a cancelled event they registered for');
select isnt_empty(
  $$ select id from public.registrations where event_id = '40000000-0000-0000-0000-0000000000a1' $$,
  'volunteer still sees their registration after the event is cancelled');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a3", "role": "authenticated"}';

select is_empty(
  $$ select id from public.events where status <> 'published' $$,
  'volunteers who did not register see no cancelled, completed, or draft events');

reset role;

select * from finish();
rollback;
