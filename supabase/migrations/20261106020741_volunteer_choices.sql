-- Weekday and shift options as enums (FOR-21), so the generated types list the
-- allowed values (Constants.public.Enums.weekday and .shift).

create type public.weekday as enum ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
create type public.shift as enum ('morning', 'afternoon', 'evening');

alter table public.volunteers
  drop constraint volunteers_availability_days_check,
  drop constraint volunteers_shift_preference_check,
  alter column availability_days drop default;

alter table public.volunteers
  alter column availability_days type public.weekday[] using availability_days::public.weekday[],
  alter column availability_days set default '{}',
  alter column shift_preference type public.shift using shift_preference::public.shift;
