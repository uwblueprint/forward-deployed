-- Single-organization mode tests (FOR-90). Run: npx supabase test db.
-- Runs in one transaction and rolls back. Starts from an empty project.

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values ('d0000000-0000-0000-0000-000000000001', 'early@example.com', now());
select is_empty($$ select 1 from public.memberships where user_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'with no organization yet, a signup joins nothing');

insert into public.organizations (id, name) values ('d1000000-0000-0000-0000-000000000001', 'The Org');

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('d0000000-0000-0000-0000-000000000002', 'volunteer@example.com', now(),
  '{"first_name": "Val", "role": "admin", "organization_id": "d1000000-0000-0000-0000-0000000000ff"}');
select results_eq($$ select organization_id, role::text from public.memberships where user_id = 'd0000000-0000-0000-0000-000000000002' $$,
  $$ values ('d1000000-0000-0000-0000-000000000001'::uuid, 'volunteer') $$, 'a signup joins the organization as a volunteer, whatever the metadata says');

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok($$ insert into public.volunteers (user_id, phone) values ('d0000000-0000-0000-0000-000000000002', '519-555-0100') $$, 'the new volunteer can fill in their profile right away');
select results_eq('select organization_id from public.volunteers', $$ values ('d1000000-0000-0000-0000-000000000001'::uuid) $$, 'in their organization');
reset role;

-- The first admin, made server-side.
insert into auth.users (id, email, email_confirmed_at) values ('d0000000-0000-0000-0000-0000000000a0', 'admin@example.com', now());
update public.memberships set role = 'admin' where user_id = 'd0000000-0000-0000-0000-0000000000a0';

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ select set_config('test.manager_token', (select token from public.create_invitation('new.manager@example.com', 'manager')), true) $$, 'admin invites a manager who hasn''t signed up');
select lives_ok($$ select set_config('test.volunteer_token', (select token from public.create_invitation('promoted@example.com', 'volunteer')), true) $$, 'admin invites someone as a volunteer');
reset role;

insert into auth.users (id, email, email_confirmed_at) values
  ('d0000000-0000-0000-0000-000000000003', 'new.manager@example.com', now()),
  ('d0000000-0000-0000-0000-000000000004', 'promoted@example.com', now());

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select results_eq($$ select public.redeem_invitation(current_setting('test.manager_token')) $$, $$ values ('d1000000-0000-0000-0000-000000000001'::uuid) $$,
  'someone who signed up first can still redeem their invitation');
select results_eq('select role::text from public.memberships where user_id = auth.uid()', $$ values ('manager') $$, 'which raises them to the invited role');

set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ select public.set_user_role('d0000000-0000-0000-0000-000000000004', 'manager') $$, 'admin promotes the other invitee before they redeem');
set local request.jwt.claims = '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
select lives_ok($$ select public.redeem_invitation(current_setting('test.volunteer_token')) $$, 'they redeem their volunteer invitation');
select results_eq('select role::text from public.memberships where user_id = auth.uid()', $$ values ('manager') $$, 'an invitation never lowers a role');
reset role;

insert into public.organizations (id, name) values ('d1000000-0000-0000-0000-000000000002', 'A second org');
select throws_ok($$ insert into auth.users (id, email) values ('d0000000-0000-0000-0000-000000000005', 'late@example.com') $$,
  'P0001', 'Single-organization mode needs exactly one organization, but this project has several', 'with two organizations, signup fails loudly');

select * from finish();
rollback;
