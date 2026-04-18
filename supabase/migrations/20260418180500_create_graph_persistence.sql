create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_user_name_unique unique (user_id, normalized_name)
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  tag_id uuid references public.tags (id) on delete set null,
  x double precision not null default 0,
  y double precision not null default 0,
  is_root boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_root_coordinates_check check ((not is_root) or (x = 0 and y = 0))
);

create unique index if not exists people_one_root_per_board_idx
on public.people (board_id)
where is_root;

create index if not exists people_board_id_idx on public.people (board_id);
create index if not exists people_owner_user_id_idx on public.people (owner_user_id);
create index if not exists people_tag_id_idx on public.people (tag_id);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_person_id_idx on public.notes (person_id);
create index if not exists notes_owner_user_id_idx on public.notes (owner_user_id);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  person_a_id uuid not null references public.people (id) on delete cascade,
  person_b_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint connections_distinct_people_check check (person_a_id <> person_b_id),
  constraint connections_unique_pair unique (board_id, person_a_id, person_b_id)
);

create index if not exists connections_board_id_idx on public.connections (board_id);
create index if not exists connections_owner_user_id_idx on public.connections (owner_user_id);
create index if not exists connections_person_a_id_idx on public.connections (person_a_id);
create index if not exists connections_person_b_id_idx on public.connections (person_b_id);

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at
before update on public.people
for each row
execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

create or replace function public.validate_person_tag_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tag_owner uuid;
begin
  if new.tag_id is null then
    return new;
  end if;

  select tags.user_id
  into tag_owner
  from public.tags
  where tags.id = new.tag_id;

  if tag_owner is null then
    raise exception 'Tag does not exist.';
  end if;

  if tag_owner <> new.owner_user_id then
    raise exception 'Tag must belong to the same user as the person.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_invalid_root_person_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.is_root then
    raise exception 'Root person cannot be deleted.';
  end if;

  if tg_op = 'UPDATE' and old.is_root then
    if new.is_root is distinct from true then
      raise exception 'Root person must remain the root.';
    end if;

    if new.x <> 0 or new.y <> 0 then
      raise exception 'Root person must remain at coordinates 0,0.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.is_root then
    new.x = 0;
    new.y = 0;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.validate_note_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  person_owner uuid;
begin
  select people.owner_user_id
  into person_owner
  from public.people
  where people.id = new.person_id;

  if person_owner is null then
    raise exception 'Person does not exist.';
  end if;

  if person_owner <> new.owner_user_id then
    raise exception 'Note must belong to the same user as the person.';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_connection()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  first_person public.people%rowtype;
  second_person public.people%rowtype;
  swap_id uuid;
begin
  if new.person_a_id = new.person_b_id then
    raise exception 'A connection must reference two different people.';
  end if;

  if new.person_a_id > new.person_b_id then
    swap_id := new.person_a_id;
    new.person_a_id := new.person_b_id;
    new.person_b_id := swap_id;
  end if;

  select *
  into first_person
  from public.people
  where people.id = new.person_a_id;

  select *
  into second_person
  from public.people
  where people.id = new.person_b_id;

  if first_person.id is null or second_person.id is null then
    raise exception 'Both people must exist.';
  end if;

  if first_person.board_id <> second_person.board_id then
    raise exception 'Connected people must be on the same board.';
  end if;

  if first_person.owner_user_id <> second_person.owner_user_id then
    raise exception 'Connected people must belong to the same user.';
  end if;

  if new.board_id <> first_person.board_id then
    raise exception 'Connection board must match the people board.';
  end if;

  if new.owner_user_id <> first_person.owner_user_id then
    raise exception 'Connection owner must match the people owner.';
  end if;

  return new;
end;
$$;

drop trigger if exists people_validate_tag_ownership on public.people;
create trigger people_validate_tag_ownership
before insert or update on public.people
for each row
execute function public.validate_person_tag_ownership();

drop trigger if exists people_protect_root_person on public.people;
create trigger people_protect_root_person
before insert or update or delete on public.people
for each row
execute function public.prevent_invalid_root_person_changes();

drop trigger if exists notes_validate_owner on public.notes;
create trigger notes_validate_owner
before insert or update on public.notes
for each row
execute function public.validate_note_owner();

drop trigger if exists connections_prepare_trigger on public.connections;
create trigger connections_prepare_trigger
before insert or update on public.connections
for each row
execute function public.prepare_connection();

alter table public.tags enable row level security;
alter table public.people enable row level security;
alter table public.notes enable row level security;
alter table public.connections enable row level security;

drop policy if exists "Users can read their own tags" on public.tags;
create policy "Users can read their own tags"
on public.tags
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own tags" on public.tags;
create policy "Users can insert their own tags"
on public.tags
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own tags" on public.tags;
create policy "Users can update their own tags"
on public.tags
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own tags" on public.tags;
create policy "Users can delete their own tags"
on public.tags
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can read their own people" on public.people;
create policy "Users can read their own people"
on public.people
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can insert their own people" on public.people;
create policy "Users can insert their own people"
on public.people
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can update their own people" on public.people;
create policy "Users can update their own people"
on public.people
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can delete their own people" on public.people;
create policy "Users can delete their own people"
on public.people
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can read their own notes" on public.notes;
create policy "Users can read their own notes"
on public.notes
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can insert their own notes" on public.notes;
create policy "Users can insert their own notes"
on public.notes
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
on public.notes
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
on public.notes
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can read their own connections" on public.connections;
create policy "Users can read their own connections"
on public.connections
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can insert their own connections" on public.connections;
create policy "Users can insert their own connections"
on public.connections
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can delete their own connections" on public.connections;
create policy "Users can delete their own connections"
on public.connections
for delete
to authenticated
using (owner_user_id = (select auth.uid()));
