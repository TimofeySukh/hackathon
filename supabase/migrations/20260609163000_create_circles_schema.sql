-- Reconciling "You" circle with root person:
-- We define a single root circle (circles.is_root = true) per board.
-- The root circle is pinned at (0, 0) and cannot be deleted.
-- The root person (people.is_root = true) lives inside the root circle.
-- When a new board is loaded, if no root circle exists, we create one and associate the root person with it.

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  icon text not null default '',
  x double precision not null default 0,
  y double precision not null default 0,
  radius double precision not null default 126,
  min_radius double precision not null default 126,
  parent_id uuid references public.circles (id) on delete cascade,
  connected_to uuid references public.circles (id) on delete set null,
  tone text not null default 'blue',
  shape_type text not null default 'wavy',
  sides integer not null default 12,
  amplitude double precision not null default 7,
  image_url text,
  is_root boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint circles_root_coordinates_check check ((not is_root) or (x = 0 and y = 0))
);

create unique index if not exists circles_one_root_per_board_idx
on public.circles (board_id)
where is_root;

create index if not exists circles_board_id_idx on public.circles (board_id);
create index if not exists circles_owner_user_id_idx on public.circles (owner_user_id);
create index if not exists circles_parent_id_idx on public.circles (parent_id);

-- Triggers for updated_at
drop trigger if exists circles_set_updated_at on public.circles;
create trigger circles_set_updated_at
before update on public.circles
for each row
execute function public.set_updated_at();

-- Add new columns to people
alter table public.people
add column if not exists circle_id uuid references public.circles (id) on delete set null,
add column if not exists role text not null default '',
add column if not exists avatar text not null default '',
add column if not exists shape_type text,
add column if not exists sides integer,
add column if not exists amplitude double precision,
add column if not exists image_url text;

-- Triggers to validate circle and relation ownership
create or replace function public.validate_circle_relations_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_owner uuid;
  parent_board uuid;
  connected_owner uuid;
  connected_board uuid;
begin
  if new.parent_id is not null then
    select circles.owner_user_id, circles.board_id
    into parent_owner, parent_board
    from public.circles
    where circles.id = new.parent_id;

    if parent_owner is null then
      raise exception 'Parent circle does not exist.';
    end if;

    if parent_owner <> new.owner_user_id then
      raise exception 'Parent circle must belong to the same user.';
    end if;

    if parent_board <> new.board_id then
      raise exception 'Parent circle must belong to the same board.';
    end if;
  end if;

  if new.connected_to is not null then
    select circles.owner_user_id, circles.board_id
    into connected_owner, connected_board
    from public.circles
    where circles.id = new.connected_to;

    if connected_owner is null then
      raise exception 'Connected circle does not exist.';
    end if;

    if connected_owner <> new.owner_user_id then
      raise exception 'Connected circle must belong to the same user.';
    end if;

    if connected_board <> new.board_id then
      raise exception 'Connected circle must belong to the same board.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists circles_validate_relations_ownership on public.circles;
create trigger circles_validate_relations_ownership
before insert or update on public.circles
for each row
execute function public.validate_circle_relations_ownership();

-- Trigger to validate person's circle ownership
create or replace function public.validate_person_circle_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  circle_owner uuid;
  circle_board uuid;
begin
  if new.circle_id is null then
    return new;
  end if;

  select circles.owner_user_id, circles.board_id
  into circle_owner, circle_board
  from public.circles
  where circles.id = new.circle_id;

  if circle_owner is null then
    raise exception 'Circle does not exist.';
  end if;

  if circle_owner <> new.owner_user_id then
    raise exception 'Circle must belong to the same user as the person.';
  end if;

  if circle_board <> new.board_id then
    raise exception 'Circle must belong to the same board as the person.';
  end if;

  return new;
end;
$$;

drop trigger if exists people_validate_circle_ownership on public.people;
create trigger people_validate_circle_ownership
before insert or update on public.people
for each row
execute function public.validate_person_circle_ownership();

-- Trigger to protect root circle
create or replace function public.prevent_invalid_root_circle_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.is_root then
    raise exception 'Root circle cannot be deleted.';
  end if;

  if tg_op = 'UPDATE' and old.is_root then
    if new.is_root is distinct from true then
      raise exception 'Root circle must remain the root.';
    end if;

    if new.x <> 0 or new.y <> 0 then
      raise exception 'Root circle must remain at coordinates 0,0.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.is_root then
    new.x = 0;
    new.y = 0;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists circles_protect_root_circle on public.circles;
create trigger circles_protect_root_circle
before insert or update or delete on public.circles
for each row
execute function public.prevent_invalid_root_circle_changes();

-- RLS policies for circles
alter table public.circles enable row level security;

drop policy if exists "Users can read their own circles" on public.circles;
create policy "Users can read their own circles"
on public.circles
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can insert their own circles" on public.circles;
create policy "Users can insert their own circles"
on public.circles
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can update their own circles" on public.circles;
create policy "Users can update their own circles"
on public.circles
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can delete their own circles" on public.circles;
create policy "Users can delete their own circles"
on public.circles
for delete
to authenticated
using (owner_user_id = (select auth.uid()));
