#!/usr/bin/env bash
# Races two database sessions, which the pgTAP tests (one transaction) can't.
# Run against the local database: npx supabase db start && supabase/tests/concurrency.sh
# It cleans up its rows, except the audit log entries, which can't be deleted.
set -euo pipefail

db() { docker exec -i supabase_db_forward-deployed psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=1 "$@"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

ORG=f0000000-0000-0000-0000-000000000001
E_FULL=f0000000-0000-0000-0000-0000000000e1
E_DELETE=f0000000-0000-0000-0000-0000000000e2
V1=f0000000-0000-0000-0000-0000000000b1
V2=f0000000-0000-0000-0000-0000000000b2

cleanup() { db -c "delete from public.organizations where id = '$ORG'; delete from auth.users where id::text like 'f0000000-%';" >/dev/null; }
trap cleanup EXIT
cleanup

db <<SQL
insert into public.organizations (id, name) values ('$ORG', 'Concurrency test');
insert into auth.users (id, email) values ('f0000000-0000-0000-0000-0000000000a1', 'race1@example.com'), ('f0000000-0000-0000-0000-0000000000a2', 'race2@example.com');
insert into public.memberships (user_id, organization_id) values ('f0000000-0000-0000-0000-0000000000a1', '$ORG'), ('f0000000-0000-0000-0000-0000000000a2', '$ORG');
insert into public.volunteers (id, user_id) values ('$V1', 'f0000000-0000-0000-0000-0000000000a1'), ('$V2', 'f0000000-0000-0000-0000-0000000000a2');
insert into public.events (id, organization_id, status, title, starts_at, ends_at, capacity) values
  ('$E_FULL', '$ORG', 'published', 'One spot', now() + interval '1 day', now() + interval '1 day 1 hour', 1),
  ('$E_DELETE', '$ORG', 'published', 'Deleted', now() + interval '1 day', now() + interval '1 day 1 hour', null);
SQL

# The first session holds its registration open while the second arrives.
race() {
  db -c "begin; $1; select pg_sleep(2); commit;" >/dev/null &
  local first=$!
  local second_output
  second_output=$(db -c "select pg_sleep(0.5); $2;" 2>&1 >/dev/null) && fail "$3: the second session succeeded"
  wait "$first" || fail "$3: the first session failed"
  echo "$second_output"
}

out=$(race "insert into public.registrations (event_id, volunteer_id) values ('$E_FULL', '$V1')" \
  "insert into public.registrations (event_id, volunteer_id) values ('$E_FULL', '$V2')" "last spot")
grep -q "This event is full" <<<"$out" || fail "last spot: unexpected error: $out"
[ "$(db -c "select count(*) from public.registrations where event_id = '$E_FULL' and status = 'registered'")" = 1 ] || fail "last spot: event overfilled"
echo "ok - two sessions can't both take the last spot"

out=$(race "insert into public.registrations (event_id, volunteer_id) values ('$E_DELETE', '$V1')" \
  "delete from public.events where id = '$E_DELETE'" "delete")
grep -q "This event has registrations" <<<"$out" || fail "delete: unexpected error: $out"
[ "$(db -c "select count(*) from public.registrations where event_id = '$E_DELETE'")" = 1 ] || fail "delete: registration lost"
echo "ok - an event can't be deleted while a registration is being made"

db -c "update public.memberships set role = 'admin' where user_id::text like 'f0000000-%';" >/dev/null
demote() { echo "set local role authenticated; set local request.jwt.claims = '{\"sub\": \"$1\", \"role\": \"authenticated\"}'; select public.set_user_role('$2', 'volunteer')"; }
race "$(demote f0000000-0000-0000-0000-0000000000a1 f0000000-0000-0000-0000-0000000000a2)" \
  "$(demote f0000000-0000-0000-0000-0000000000a2 f0000000-0000-0000-0000-0000000000a1)" "demote" | grep -q "Only admins can change roles" \
  || fail "demote: the second admin wasn't refused"
[ "$(db -c "select count(*) from public.memberships where organization_id = '$ORG' and role = 'admin'")" = 1 ] || fail "demote: wrong number of admins left"
echo "ok - two admins demoting each other leave one admin"

db -c "insert into auth.users (id, email) values ('f0000000-0000-0000-0000-0000000000a3', 'race3@example.com');" >/dev/null
db -c "begin; insert into public.memberships (user_id, organization_id) values ('f0000000-0000-0000-0000-0000000000a3', '$ORG'); select pg_sleep(2); commit;" >/dev/null &
joining=$!
db -c "select pg_sleep(0.5); insert into public.volunteers (user_id) values ('f0000000-0000-0000-0000-0000000000a3');" >/dev/null || fail "join: the profile insert failed"
wait "$joining" || fail "join: the membership insert failed"
[ "$(db -c "select organization_id from public.volunteers where user_id = 'f0000000-0000-0000-0000-0000000000a3'")" = "$ORG" ] || fail "join: the profile was left without an organization"
echo "ok - a profile saved while its owner joins lands in the organization"

out=$(db -c "begin isolation level repeatable read; insert into public.registrations (event_id, volunteer_id) values ('$E_DELETE', '$V2'); commit;" 2>&1 >/dev/null) && fail "isolation: insert succeeded"
grep -q "read committed" <<<"$out" || fail "isolation: unexpected error: $out"
echo "ok - registrations at stricter isolation levels are refused"
