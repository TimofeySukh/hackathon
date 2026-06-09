-- Rename tags table to zones
alter table public.tags rename to zones;

-- Rename trigger on zones
alter trigger tags_set_updated_at on public.zones rename to zones_set_updated_at;

-- Add new circle fields to zones
alter table public.zones
  add column if not exists x double precision not null default 0,
  add column if not exists y double precision not null default 0,
  add column if not exists radius double precision not null default 150,
  add column if not exists parent_zone_id uuid references public.zones (id) on delete cascade,
  add column if not exists connected_to_zone_id uuid references public.zones (id) on delete set null,
  add column if not exists tone text not null default 'blue',
  add column if not exists shape_type text not null default 'wavy',
  add column if not exists sides integer not null default 8,
  add column if not exists amplitude double precision not null default 8,
  add column if not exists icon text not null default 'C',
  add column if not exists image_url text;

-- Rename tag_id to zone_id in people
alter table public.people rename column tag_id to zone_id;

-- Add avatar/shape customization to people
alter table public.people
  add column if not exists avatar text,
  add column if not exists shape_type text not null default 'polygon',
  add column if not exists sides integer not null default 8,
  add column if not exists amplitude double precision not null default 2,
  add column if not exists image_url text;

-- Rename validator function and update its logic
create or replace function public.validate_person_zone_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  zone_owner uuid;
begin
  if new.zone_id is null then
    return new;
  end if;

  select user_id
  into zone_owner
  from public.zones
  where id = new.zone_id;

  if zone_owner is null then
    raise exception 'Zone does not exist.';
  end if;

  if zone_owner <> new.owner_user_id then
    raise exception 'Zone must belong to the same user as the person.';
  end if;

  return new;
end;
$$;

-- Drop old validation trigger and create new one
drop trigger if exists people_validate_tag_ownership on public.people;
create trigger people_validate_zone_ownership
before insert or update on public.people
for each row
execute function public.validate_person_zone_ownership();

-- Update RLS policies by dropping old ones and recreating under the new name
drop policy if exists "Users can read their own tags" on public.zones;
create policy "Users can read their own zones"
on public.zones
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own tags" on public.zones;
create policy "Users can insert their own zones"
on public.zones
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own tags" on public.zones;
create policy "Users can update their own zones"
on public.zones
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own tags" on public.zones;
create policy "Users can delete their own zones"
on public.zones
for delete
to authenticated
using (user_id = (select auth.uid()));
