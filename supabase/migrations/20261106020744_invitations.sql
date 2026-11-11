-- Invitations (FOR-69, FOR-73): how people join an organization. An admin
-- invites an email address with a role and gets a single-use token for the
-- invite link. Signing in with that address and redeeming the token creates
-- the membership. An invitation stops working if its issuer stops being an
-- admin there.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role public.app_role not null default 'volunteer',
  token_hash text not null unique, -- sha256 of the token; the token itself is never stored
  issued_by uuid references public.users (id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open invitation per address per organization; inviting again replaces it.
create unique index invitations_one_open_per_email
  on public.invitations (organization_id, email) where revoked_at is null and redeemed_at is null;
create index on public.invitations (organization_id);
create index on public.invitations (issued_by);
create index on public.invitations (redeemed_by);

create trigger set_updated_at before update on public.invitations
  for each row execute function private.set_updated_at();
alter table public.invitations enable row level security;

-- Read-only through the API; the functions below make the changes.
revoke all on table public.invitations from anon, authenticated;
grant select, insert, update, delete on table public.invitations to service_role;
grant select on table public.invitations to authenticated;

create policy "invitations: admins read own org"
  on public.invitations for select to authenticated
  using ((select private.is_admin()) and organization_id = (select private.current_org_id()));

-- Returns the token once. Invitations expire after 7 days.
-- Exposed as an API call: supabase.rpc("create_invitation", { invitee_email, invitee_role }).
create function public.create_invitation(invitee_email text, invitee_role public.app_role default 'volunteer')
returns table (invitation_id uuid, token text)
language plpgsql security definer set search_path = ''
as $$
declare
  org uuid := (select private.current_org_id());
  address text := lower(btrim(invitee_email));
  new_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can invite people' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.memberships m join public.users u on u.id = m.user_id
    where m.organization_id = org and lower(u.email) = address
  ) then
    raise exception 'That person is already a member' using errcode = '23505';
  end if;
  update public.invitations set revoked_at = now()
  where organization_id = org and email = address and revoked_at is null and redeemed_at is null;
  return query
    insert into public.invitations (organization_id, email, role, token_hash, issued_by, expires_at)
    values (org, address, invitee_role, encode(extensions.digest(new_token, 'sha256'), 'hex'), (select auth.uid()), now() + interval '7 days')
    returning id, new_token;
end;
$$;

-- Exposed as an API call: supabase.rpc("revoke_invitation", { target_invitation_id }).
create function public.revoke_invitation(target_invitation_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can revoke invitations' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now()
  where id = target_invitation_id and organization_id = (select private.current_org_id())
    and revoked_at is null and redeemed_at is null;
  if not found then
    raise exception 'No open invitation with that id in your organization' using errcode = 'P0002';
  end if;
end;
$$;

-- Joins the caller to the invitation's organization with its role and returns
-- the organization id. Retrying after success returns the same id while the
-- membership lasts.
-- Exposed as an API call: supabase.rpc("redeem_invitation", { invitation_token }).
create function public.redeem_invitation(invitation_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  invite public.invitations;
  caller_email text;
  confirmed boolean;
begin
  select * into invite from public.invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
  for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if invite.redeemed_by = (select auth.uid()) and exists (
    select 1 from public.memberships where user_id = invite.redeemed_by and organization_id = invite.organization_id
  ) then
    return invite.organization_id;
  end if;
  if invite.redeemed_at is not null then
    raise exception 'Invitation already used' using errcode = '22023';
  end if;
  if invite.revoked_at is not null or not exists (
    select 1 from public.memberships
    where user_id = invite.issued_by and organization_id = invite.organization_id and role = 'admin'
  ) then
    raise exception 'Invitation revoked' using errcode = '22023';
  end if;
  if invite.expires_at <= now() then
    raise exception 'Invitation expired' using errcode = '22023';
  end if;
  select lower(email), email_confirmed_at is not null into caller_email, confirmed
  from auth.users where id = (select auth.uid());
  if caller_email is distinct from invite.email then
    raise exception 'This invitation is for a different email address' using errcode = '42501';
  end if;
  if not confirmed then
    raise exception 'Confirm your email address first' using errcode = '42501';
  end if;
  begin
    insert into public.memberships (user_id, organization_id, role)
    values ((select auth.uid()), invite.organization_id, invite.role);
  exception when unique_violation then
    raise exception 'You already belong to an organization' using errcode = '23505';
  end;
  update public.invitations set redeemed_at = now(), redeemed_by = (select auth.uid()) where id = invite.id;
  return invite.organization_id;
end;
$$;

-- An admin who is demoted or leaves takes their open invitations with them.
create function private.revoke_issuer_invitations() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.role = 'admin' and new.organization_id = old.organization_id then
    return null;
  end if;
  update public.invitations set revoked_at = now()
  where issued_by = old.user_id and organization_id = old.organization_id
    and revoked_at is null and redeemed_at is null;
  return null;
end;
$$;

create trigger revoke_issuer_invitations
  after update of role, organization_id or delete on public.memberships
  for each row when (old.role = 'admin')
  execute function private.revoke_issuer_invitations();

revoke execute on function public.create_invitation(text, public.app_role), public.revoke_invitation(uuid), public.redeem_invitation(text)
  from public, anon;
grant execute on function public.create_invitation(text, public.app_role), public.revoke_invitation(uuid), public.redeem_invitation(text)
  to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
