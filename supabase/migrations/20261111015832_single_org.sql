-- Single-organization mode (FOR-90): each deployment has one organization, and
-- everyone who signs up joins it as a volunteer. More than one organization is
-- a misconfiguration, so signups fail loudly instead of picking one. With no
-- organization yet, signups get no membership; db:bootstrap-admin attaches them
-- when it creates the organization.

create function private.default_organization_id() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  org_ids uuid[] := array(select id from public.organizations limit 2);
begin
  if cardinality(org_ids) > 1 then
    raise exception 'Single-organization mode needs exactly one organization, but this project has several';
  end if;
  return org_ids[1];
end;
$$;

create or replace function private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  full_name text := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  org uuid := private.default_organization_id();
begin
  insert into public.users (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(full_name, ' ', 1)), ''),
    nullif(coalesce(meta ->> 'last_name', meta ->> 'family_name', trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1))), '')
  );
  if org is not null then
    insert into public.memberships (user_id, organization_id) values (new.id, org);
  end if;
  return new;
end;
$$;

-- Invitations now mostly bring in staff: the invitee usually signed up first,
-- so redeeming raises their existing role instead of creating a membership.
create or replace function public.redeem_invitation(invitation_token text) returns uuid
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
    -- Signing up already made them a member here. The invitation can raise
    -- their role but never lower it.
    update public.memberships set role = invite.role
    where user_id = (select auth.uid()) and organization_id = invite.organization_id
      and (role = 'volunteer' or (role = 'manager' and invite.role = 'admin'));
    if not exists (select 1 from public.memberships where user_id = (select auth.uid()) and organization_id = invite.organization_id) then
      raise exception 'You already belong to an organization' using errcode = '23505';
    end if;
  end;
  update public.invitations set redeemed_at = now(), redeemed_by = (select auth.uid()) where id = invite.id;
  return invite.organization_id;
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
