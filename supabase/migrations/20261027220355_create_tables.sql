-- Core tables (FOR-23, PRD schema). Access rules are in the next migration.

create schema private;

create type public.app_role as enum ('admin', 'manager', 'volunteer');
create type public.volunteer_status as enum ('pending', 'approved', 'rejected');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.registration_status as enum ('registered', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  role public.app_role not null default 'volunteer',
  first_name text,
  last_name text,
  email text, -- mirror of auth.users.email, kept in sync by a trigger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.volunteers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  status public.volunteer_status not null default 'pending', -- mirror of the latest application
  phone text,
  location text,
  -- Same options as WEEKDAYS and SHIFTS in the onboarding form schema.
  availability_days text[] not null default '{}'
    check (availability_days <@ array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  shift_preference text check (shift_preference in ('morning', 'afternoon', 'evening')),
  skills text[] not null default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  status public.volunteer_status not null default 'pending',
  responses jsonb not null default '{}', -- keyed by custom_fields.id
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status public.event_status not null default 'draft',
  title text not null,
  description text,
  category text,
  location text,
  requirements text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  status public.registration_status not null default 'registered',
  attendance_status text check (attendance_status in ('attended', 'no_show')),
  custom_responses jsonb not null default '{}', -- keyed by custom_fields.id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, volunteer_id)
);

-- Organization-specific questions on applications and event registrations.
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null check (entity_type in ('application', 'registration')),
  field_name text not null,
  field_type text not null
    check (field_type in ('text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox')),
  required boolean not null default false,
  options jsonb not null default '[]',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open application per volunteer.
create unique index applications_one_pending_per_volunteer
  on public.applications (volunteer_id) where status = 'pending';

create index on public.users (organization_id);
create index on public.applications (volunteer_id, submitted_at desc);
create index on public.applications (reviewed_by);
create index on public.events (organization_id);
create index on public.registrations (volunteer_id);
create index on public.custom_fields (organization_id, entity_type, position);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['organizations', 'users', 'volunteers', 'applications', 'events', 'registrations', 'custom_fields'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;
