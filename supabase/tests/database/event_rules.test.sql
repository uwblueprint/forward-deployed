-- Event status changes, attendance, and the audit of staff changes to signups.
-- Run: npx supabase test db. Rolls back.
-- Users: a0 admin, a5 manager, a1 and a2 volunteers.
-- Events: d1 draft, d2 draft already started, p1 published with a signup, p2 published and started,
-- p3 published with only a cancelled signup, p4 published with a1's own signup, c1 cancelled, k1 completed.

begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Start from no organization, so the suite also passes on a seeded database.
delete from public.organizations;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-0000000000a0', 'admin.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a1', 'one.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a2', 'two.a@example.com'),
  ('20000000-0000-0000-0000-0000000000a5', 'manager.a@example.com');

insert into public.organizations (id, name) values ('10000000-0000-0000-0000-00000000000a', 'Org A');

insert into public.memberships (user_id, organization_id, role) values
  ('20000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-00000000000a', 'admin'),
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-00000000000a', 'manager');

insert into public.volunteers (id, user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2');

insert into public.events (id, organization_id, status, title, starts_at, ends_at) values
  ('40000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000a', 'draft', 'Draft', now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-00000000000a', 'draft', 'Draft, started', now() - interval '1 hour', now() + interval '1 hour'),
  ('40000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000a', 'published', 'Upcoming', now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-00000000000a', 'published', 'Started', now() - interval '1 hour', now() + interval '1 hour'),
  ('40000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-00000000000a', 'published', 'Upcoming, one cancelled signup', now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000f4', '10000000-0000-0000-0000-00000000000a', 'published', 'Upcoming, own signup', now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', 'cancelled', 'Cancelled', now() + interval '2 days', now() + interval '2 days 2 hours'),
  ('40000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-00000000000a', 'completed', 'Completed', now() - interval '7 days', now() - interval '7 days' + interval '2 hours');

insert into public.registrations (id, event_id, volunteer_id, status) values
  ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000a1', 'registered'),
  ('50000000-0000-0000-0000-000000000021', '40000000-0000-0000-0000-0000000000f2', '30000000-0000-0000-0000-0000000000a1', 'registered'),
  ('50000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-0000000000f2', '30000000-0000-0000-0000-0000000000a2', 'cancelled'),
  ('50000000-0000-0000-0000-000000000031', '40000000-0000-0000-0000-0000000000f3', '30000000-0000-0000-0000-0000000000a2', 'cancelled'),
  ('50000000-0000-0000-0000-000000000041', '40000000-0000-0000-0000-0000000000f4', '30000000-0000-0000-0000-0000000000a1', 'registered');

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';

-- Event status -------------------------------------------------------------------

select throws_ok($$ update public.events set status = 'completed' where id = '40000000-0000-0000-0000-0000000000d1' $$,
  '55000', 'A draft event cannot be moved to completed', 'a draft cannot be completed');
select throws_ok($$ update public.events set status = 'published' where id = '40000000-0000-0000-0000-0000000000d2' $$,
  '55000', 'An event that has already started cannot be published', 'a draft that has started cannot be published');
select lives_ok($$ update public.events set status = 'published' where id = '40000000-0000-0000-0000-0000000000d1' $$, 'a draft can be published before it starts');
select lives_ok($$ update public.events set status = 'draft' where id = '40000000-0000-0000-0000-0000000000d1' $$, 'a published event nobody signed up for can go back to draft');
select throws_ok($$ update public.events set status = 'draft' where id = '40000000-0000-0000-0000-0000000000f1' $$,
  '55000', 'An event with registrations cannot go back to draft; cancel it instead', 'an event with a signup cannot go back to draft');
select throws_ok($$ update public.events set status = 'draft' where id = '40000000-0000-0000-0000-0000000000f3' $$,
  '55000', null, 'a cancelled signup still counts as having had one');
select throws_ok($$ update public.events set status = 'completed' where id = '40000000-0000-0000-0000-0000000000f1' $$,
  '55000', 'An event cannot be completed before it starts', 'an event cannot be completed before it starts');
select throws_ok($$ update public.events set status = 'published' where id = '40000000-0000-0000-0000-0000000000c1' $$,
  '55000', 'A cancelled event cannot change status', 'a cancelled event cannot be republished');
select throws_ok($$ update public.events set status = 'draft' where id = '40000000-0000-0000-0000-0000000000c1' $$,
  '55000', null, 'or go back to draft');
select throws_ok($$ update public.events set status = 'cancelled' where id = '40000000-0000-0000-0000-0000000000e1' $$,
  '55000', 'A completed event cannot change status', 'a completed event cannot be cancelled');
select lives_ok($$ update public.events set title = 'Cancelled, renamed' where id = '40000000-0000-0000-0000-0000000000c1' $$, 'other edits to a cancelled event still work');
select lives_ok($$ update public.events set status = 'cancelled' where id = '40000000-0000-0000-0000-0000000000d1' $$, 'a draft can be cancelled');

-- Attendance ---------------------------------------------------------------------

select throws_ok($$ update public.registrations set attendance_status = 'attended' where id = '50000000-0000-0000-0000-000000000011' $$,
  '55000', 'Attendance cannot be recorded before the event starts', 'no attendance before the event starts');
select throws_ok($$ update public.registrations set attendance_status = 'attended' where id = '50000000-0000-0000-0000-000000000022' $$,
  '55000', 'A cancelled registration cannot have attendance', 'no attendance on a cancelled signup');
select lives_ok($$ update public.registrations set attendance_status = 'attended' where id = '50000000-0000-0000-0000-000000000021' $$, 'attendance is recorded once the event has started');
select lives_ok($$ update public.registrations set attendance_status = 'no_show' where id = '50000000-0000-0000-0000-000000000021' $$, 'and can be corrected');
select throws_ok($$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-000000000021' $$,
  '55000', 'A cancelled registration cannot have attendance', 'a signup with attendance cannot be cancelled afterwards');
select lives_ok($$ update public.events set status = 'completed' where id = '40000000-0000-0000-0000-0000000000f2' $$, 'a started event can be completed');
reset role;
select throws_ok($$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-000000000021' $$,
  '23514', null, 'the rule holds for server-side writes too');

-- Audit --------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select lives_ok($$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-000000000011' $$, 'a manager cancels a volunteer''s signup');
select lives_ok($$ update public.registrations set status = 'registered' where id = '50000000-0000-0000-0000-000000000031' $$, 'and restores another');
select is_empty($$ select 1 from public.audit_log $$, 'a manager still cannot read the audit log');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$ update public.registrations set status = 'cancelled' where id = '50000000-0000-0000-0000-000000000041' $$, 'a volunteer cancels their own signup');
select throws_ok($$ insert into public.audit_log (organization_id, action, entity_id) values ('10000000-0000-0000-0000-00000000000a', 'registration_status', '50000000-0000-0000-0000-000000000041') $$,
  '42501', null, 'nobody writes the audit log directly');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select results_eq($$ select entity_id, actor_id, old_value, new_value from public.audit_log where action = 'registration_status' order by id $$,
  $$ values ('50000000-0000-0000-0000-000000000011'::uuid, '20000000-0000-0000-0000-0000000000a5'::uuid, 'registered', 'cancelled'),
            ('50000000-0000-0000-0000-000000000031'::uuid, '20000000-0000-0000-0000-0000000000a5'::uuid, 'cancelled', 'registered') $$,
  'the admin sees who changed each signup, and the volunteer''s own cancellation isn''t logged');
select results_eq($$ select count(*) from public.audit_log where action = 'event_status' and entity_id = '40000000-0000-0000-0000-0000000000f2' and new_value = 'completed' $$,
  $$ values (1::bigint) $$, 'event status changes are still logged');
reset role;
select is((select count(*) from public.registrations where status = 'cancelled' and attendance_status is not null), 0::bigint,
  'no cancelled signup has attendance');

select * from finish();
rollback;
