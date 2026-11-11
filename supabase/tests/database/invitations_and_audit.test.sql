-- Invitation and audit-log tests. Run: npx supabase test db (needs npx supabase start).
-- Runs in one transaction and rolls back. Same ID prefixes as access_control.test.sql,
-- plus 8 for invitations. Users: a0 admin, a1 volunteer, a2 volunteer, a5 manager,
-- a9 second admin, b0 org B admin, c1 invitee, c2 someone else, c3 unconfirmed
-- email, c4 invited by a9, c5 invited to org A by org B's admin.

begin;
create extension if not exists pgtap with schema extensions;
select plan(67);

insert into public.organizations (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Org A'),
  ('10000000-0000-0000-0000-00000000000b', 'Org B');

insert into auth.users (id, email, email_confirmed_at) values
  ('20000000-0000-0000-0000-0000000000a0', 'admin.a@example.com', now()),
  ('20000000-0000-0000-0000-0000000000a1', 'volunteer.a@example.com', now()),
  ('20000000-0000-0000-0000-0000000000a2', 'second.a@example.com', now()),
  ('20000000-0000-0000-0000-0000000000a5', 'manager.a@example.com', now()),
  ('20000000-0000-0000-0000-0000000000a9', 'admin2.a@example.com', now()),
  ('20000000-0000-0000-0000-0000000000b0', 'admin.b@example.com', now()),
  ('20000000-0000-0000-0000-0000000000c1', 'invitee@example.com', now()),
  ('20000000-0000-0000-0000-0000000000c2', 'someone.else@example.com', now()),
  ('20000000-0000-0000-0000-0000000000c3', 'unconfirmed@example.com', null),
  ('20000000-0000-0000-0000-0000000000c4', 'late@example.com', now()),
  ('20000000-0000-0000-0000-0000000000c5', 'cross@example.com', now());

insert into public.memberships (user_id, organization_id, role) values
  ('20000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-00000000000a', 'admin'),
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'volunteer'),
  ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-00000000000a', 'manager'),
  ('20000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', 'admin'),
  ('20000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-00000000000b', 'admin');

insert into public.volunteers (id, user_id, organization_id) values ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a');
insert into public.applications (id, volunteer_id) values ('60000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1');
insert into public.events (id, organization_id, status, title, starts_at, ends_at) values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'published', 'A event', now() + interval '1 day', now() + interval '1 day 2 hours');

-- Tokens for org B invitations are known so the tests can redeem them.
insert into public.invitations (id, organization_id, email, token_hash, issued_by, expires_at) values
  ('80000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'invitee@example.com', encode(extensions.digest('b-open', 'sha256'), 'hex'),
    '20000000-0000-0000-0000-0000000000b0', now() + interval '7 days'),
  ('80000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-00000000000b', 'expired@example.com', encode(extensions.digest('b-expired', 'sha256'), 'hex'),
    '20000000-0000-0000-0000-0000000000b0', now() - interval '1 day'),
  ('80000000-0000-0000-0000-0000000000a9', '10000000-0000-0000-0000-00000000000a', 'cross@example.com', encode(extensions.digest('a-cross', 'sha256'), 'hex'),
    '20000000-0000-0000-0000-0000000000b0', now() + interval '7 days');

-- Audit log ------------------------------------------------------------------------

select results_eq($$ select actor_id, old_value, new_value from public.audit_log where action = 'role' and entity_id = '20000000-0000-0000-0000-0000000000a0' $$,
  $$ values (null::uuid, null::text, 'admin') $$, 'joining an organization is recorded');

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ update public.applications set status = 'approved' where id = '60000000-0000-0000-0000-0000000000a1' $$, 'admin approves an application');
select results_eq($$ select actor_id, old_value, new_value from public.audit_log where entity_id = '60000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid, 'pending', 'approved') $$, 'application decisions are recorded with who made them');
select lives_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a2', 'manager') $$, 'admin changes a role');
select results_eq($$ select actor_id, old_value, new_value from public.audit_log where action = 'role' and entity_id = '20000000-0000-0000-0000-0000000000a2' order by id $$,
  $$ values (null::uuid, null::text, 'volunteer'), ('20000000-0000-0000-0000-0000000000a0', 'volunteer', 'manager') $$, 'role changes are recorded');
select lives_ok($$ update public.events set title = 'Renamed' where id = '40000000-0000-0000-0000-0000000000a1' $$, 'admin renames an event');
select lives_ok($$ update public.events set status = 'cancelled' where id = '40000000-0000-0000-0000-0000000000a1' $$, 'admin cancels an event');
select results_eq($$ select old_value, new_value from public.audit_log where entity_id = '40000000-0000-0000-0000-0000000000a1' order by id $$,
  $$ values (null::text, 'published'), ('published', 'cancelled') $$, 'event creation and status changes are recorded, other edits are not');
select lives_ok($$ with e as (insert into public.events (organization_id, title, starts_at, ends_at) values ('10000000-0000-0000-0000-00000000000a', 'Short-lived', now() + interval '1 day', now() + interval '1 day 1 hour') returning id)
  select set_config('test.event_id', id::text, true) from e $$, 'admin creates an event');
select lives_ok($$ delete from public.events where id = current_setting('test.event_id')::uuid $$, 'and deletes it');
select results_eq($$ select actor_id, old_value, new_value from public.audit_log where entity_id = current_setting('test.event_id')::uuid order by id $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid, null::text, 'draft'), ('20000000-0000-0000-0000-0000000000a0', 'draft', null) $$, 'deleting an event is recorded');
select is((select count(*) from public.audit_log where organization_id <> '10000000-0000-0000-0000-00000000000a'), 0::bigint, 'admin reads only their org''s history');
select throws_ok($$ insert into public.audit_log (action, entity_id) values ('role', '20000000-0000-0000-0000-0000000000a0') $$, '42501', null, 'admin cannot write history');
select throws_ok($$ update public.audit_log set new_value = 'x' $$, '42501', null, 'admin cannot rewrite history');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'admin cannot delete history');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select is_empty('select * from public.audit_log', 'managers cannot read history');
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is_empty('select * from public.audit_log', 'volunteers cannot read history');
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000b0", "role": "authenticated"}';
select results_eq('select distinct organization_id from public.audit_log', $$ values ('10000000-0000-0000-0000-00000000000b'::uuid) $$, 'org B admin reads only org B history');
reset role;

set local role service_role;
select throws_ok($$ insert into public.audit_log (organization_id, action, entity_id) values ('10000000-0000-0000-0000-00000000000a', 'role', '20000000-0000-0000-0000-0000000000a0') $$,
  '42501', null, 'even the secret key cannot write history');
select throws_ok($$ update public.audit_log set new_value = 'x' $$, '42501', null, 'even the secret key cannot rewrite history');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'even the secret key cannot delete history');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'even the secret key cannot truncate history');
reset role;

select throws_ok($$ delete from public.audit_log $$, '42501', 'The audit log is append-only', 'even the database owner cannot delete history');
select throws_ok($$ truncate public.audit_log $$, '42501', 'The audit log is append-only', 'even the database owner cannot truncate history');
set local session_replication_role = replica;
select throws_ok($$ delete from public.audit_log $$, '42501', 'The audit log is append-only', 'replica mode does not get around it');
set local session_replication_role = origin;

-- Issuing and revoking invitations --------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ select set_config('test.first_token', (select token from public.create_invitation('  Invitee@Example.com ', 'manager')), true) $$, 'admin can invite someone');
select results_eq($$ select email, role::text, issued_by, token_hash = encode(extensions.digest(current_setting('test.first_token'), 'sha256'), 'hex') from public.invitations where email = 'invitee@example.com' $$,
  $$ values ('invitee@example.com', 'manager', '20000000-0000-0000-0000-0000000000a0'::uuid, true) $$, 'the invitation stores the normalized address and only a hash of the token');
select is(length(current_setting('test.first_token')), 64, 'the token is 32 random bytes');
select lives_ok($$ select set_config('test.token', (select token from public.create_invitation('invitee@example.com')), true) $$, 'admin can invite the same address again');
select results_eq($$ select role::text from public.invitations where email = 'invitee@example.com' and revoked_at is null $$, $$ values ('volunteer') $$, 'inviting again replaces the open invitation');
select lives_ok($$ select set_config('test.unconfirmed_token', (select token from public.create_invitation('unconfirmed@example.com')), true) $$, 'admin invites an unconfirmed address');
select throws_ok($$ select public.create_invitation('volunteer.a@example.com') $$, '23505', 'That person is already a member', 'admin cannot invite an existing member');
select throws_ok($$ select public.create_invitation('not-an-email') $$, '23514', null, 'admin cannot invite an invalid address');
select throws_ok($$ insert into public.invitations (organization_id, email, token_hash, expires_at) values ('10000000-0000-0000-0000-00000000000a', 'x@example.com', 'x', now()) $$, '42501', null, 'invitations cannot be written directly');
select lives_ok($$ select set_config('test.revoke_id', (select invitation_id::text from public.create_invitation('revoke.me@example.com')), true) $$, 'admin invites someone to revoke');
select lives_ok($$ select public.revoke_invitation(current_setting('test.revoke_id')::uuid) $$, 'admin can revoke an invitation');
select throws_ok($$ select public.revoke_invitation(current_setting('test.revoke_id')::uuid) $$, 'P0002', null, 'a revoked invitation cannot be revoked again');
select results_eq($$ select actor_id, old_value, new_value from public.audit_log where entity_id = current_setting('test.revoke_id')::uuid order by id $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid, null::text, 'volunteer'), ('20000000-0000-0000-0000-0000000000a0', 'volunteer', 'revoked') $$, 'issuing and revoking invitations are recorded');
select throws_ok($$ select public.revoke_invitation('80000000-0000-0000-0000-0000000000b1') $$, 'P0002', null, 'admin cannot revoke an org B invitation');
select is_empty($$ select 1 from public.invitations where organization_id = '10000000-0000-0000-0000-00000000000b' $$, 'admin cannot see org B invitations');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a5", "role": "authenticated"}';
select throws_ok($$ select public.create_invitation('x@example.com') $$, '42501', 'Only admins can invite people', 'managers cannot invite');
select is_empty('select * from public.invitations', 'managers cannot see invitations');
select throws_ok($$ select public.revoke_invitation(current_setting('test.revoke_id')::uuid) $$, '42501', 'Only admins can revoke invitations', 'managers cannot revoke invitations');
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok($$ select public.create_invitation('x@example.com') $$, '42501', 'Only admins can invite people', 'volunteers cannot invite');
reset role;

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select public.create_invitation('x@example.com') $$, '42501', null, 'anon cannot invite');
select throws_ok($$ select public.redeem_invitation('b-open') $$, '42501', null, 'anon cannot redeem');
reset role;

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a9", "role": "authenticated"}';
select lives_ok($$ select set_config('test.late_token', (select token from public.create_invitation('late@example.com')), true) $$, 'a second admin invites someone');
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select lives_ok($$ select public.set_user_role('20000000-0000-0000-0000-0000000000a9', 'volunteer') $$, 'then loses their admin role');
select ok((select revoked_at is not null from public.invitations where email = 'late@example.com'), 'demoting an admin revokes their open invitations');
reset role;

-- Redeeming invitations ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c2", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation(current_setting('test.token')) $$, '42501', 'This invitation is for a different email address', 'nobody else can redeem it');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c4", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation(current_setting('test.late_token')) $$, '22023', 'Invitation revoked', 'an invitation stops working when its issuer is no longer an admin');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c5", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation('a-cross') $$, '22023', 'Invitation revoked', 'an invitation must come from an admin of its own organization');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c3", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation(current_setting('test.unconfirmed_token')) $$, '42501', 'Confirm your email address first', 'an unconfirmed address cannot redeem');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation('no-such-token') $$, 'P0002', 'Invitation not found', 'an unknown token is rejected');
select throws_ok($$ select public.redeem_invitation(current_setting('test.first_token')) $$, '22023', 'Invitation revoked', 'a replaced invitation cannot be redeemed');
select throws_ok($$ select public.redeem_invitation('b-expired') $$, '22023', 'Invitation expired', 'an expired invitation cannot be redeemed');
select results_eq($$ select public.redeem_invitation(current_setting('test.token')) $$, $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$, 'the invitee can redeem it');
select results_eq('select organization_id, role::text from public.memberships', $$ values ('10000000-0000-0000-0000-00000000000a'::uuid, 'volunteer') $$, 'redeeming creates the membership with the invited role');
select results_eq($$ select public.redeem_invitation(current_setting('test.token')) $$, $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$, 'redeeming again returns the same organization');
select throws_ok($$ select public.redeem_invitation('b-open') $$, '23505', 'You already belong to an organization', 'a member cannot join a second organization');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c2", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation(current_setting('test.token')) $$, '22023', 'Invitation already used', 'a used invitation cannot be redeemed by someone else');

set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select results_eq($$ select redeemed_by from public.invitations where redeemed_at is not null $$, $$ values ('20000000-0000-0000-0000-0000000000c1'::uuid) $$, 'the admin sees who redeemed it');
select results_eq($$ select actor_id, new_value from public.audit_log where action = 'role' and entity_id = '20000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('20000000-0000-0000-0000-0000000000c1'::uuid, 'volunteer') $$, 'joining through an invitation is recorded');
select results_eq($$ select a.actor_id, a.old_value, a.new_value from public.audit_log a join public.invitations i on i.id = a.entity_id
    where i.redeemed_by = '20000000-0000-0000-0000-0000000000c1' order by a.id $$,
  $$ values ('20000000-0000-0000-0000-0000000000a0'::uuid, null::text, 'volunteer'), ('20000000-0000-0000-0000-0000000000c1', 'volunteer', 'redeemed') $$,
  'the invitation''s history shows who issued and who redeemed it');
reset role;

set local request.jwt.claims = '{}';
delete from public.memberships where user_id = '20000000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select throws_ok($$ select public.redeem_invitation(current_setting('test.token')) $$, '22023', 'Invitation already used', 'after leaving, a used invitation cannot bring someone back');
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-0000000000a0", "role": "authenticated"}';
select results_eq($$ select actor_id, old_value, new_value from public.audit_log where action = 'role' and entity_id = '20000000-0000-0000-0000-0000000000c1' order by id $$,
  $$ values ('20000000-0000-0000-0000-0000000000c1'::uuid, null::text, 'volunteer'), (null, 'volunteer', null) $$, 'leaving is recorded too');
reset role;

delete from auth.users where id = '20000000-0000-0000-0000-0000000000c1';
select results_eq($$ select actor_id, old_value, new_value from public.audit_log where action = 'role' and entity_id = '20000000-0000-0000-0000-0000000000c1' order by id $$,
  $$ values ('20000000-0000-0000-0000-0000000000c1'::uuid, null::text, 'volunteer'), (null, 'volunteer', null) $$, 'deleting a user leaves their history in place');

select * from finish();
rollback;
