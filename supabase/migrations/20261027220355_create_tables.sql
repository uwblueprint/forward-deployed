-- Provisional schema for team review (FOR-23). Columns may change.

create type public.app_role as enum ('admin', 'volunteer');
create type public.volunteer_status as enum ('pending', 'approved', 'rejected');
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.registration_status as enum ('registered', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  role public.app_role not null default 'volunteer',
  full_name text,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.volunteers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  status public.volunteer_status not null default 'pending',
  rejection_reason text,
  reviewed_at timestamptz,
  phone text,
  location text,
  -- Mirrors WEEKDAYS and SHIFTS in src/features/volunteers/schemas/volunteerSchema.ts.
  -- Text with check constraints (not enums) so the options stay easy to change.
  availability_days text[] not null default '{}'
    check (availability_days <@ array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  shift_preference text
    check (shift_preference in ('morning', 'afternoon', 'evening')),
  skills text[] not null default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status public.event_status not null default 'draft',
  title text not null,
  description text,
  category text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity > 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  status public.registration_status not null default 'registered',
  created_at timestamptz not null default now(),
  unique (event_id, volunteer_id)
);

create index on public.users (organization_id);
create index on public.events (organization_id);
create index on public.registrations (volunteer_id);

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.volunteers enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
