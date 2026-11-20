-- Names (FOR-65): everyone edits their own; only admins edit someone else's.
-- Managers keep reviewing applications, editing volunteer profiles, and running events.

drop policy "users: update self, staff update own org" on public.users;
create policy "users: update self, admins update own org"
  on public.users for update to authenticated
  using (id = (select auth.uid()) or ((select private.is_admin()) and id in (select private.my_org_user_ids())))
  with check (id = (select auth.uid()) or ((select private.is_admin()) and id in (select private.my_org_user_ids())));
