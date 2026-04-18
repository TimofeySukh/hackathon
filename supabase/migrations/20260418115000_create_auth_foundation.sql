create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Personal board',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boards_one_per_user unique (user_id)
);

create index if not exists boards_user_id_idx on public.boards (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
before update on public.boards
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.boards enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Users can read their own boards" on public.boards;
create policy "Users can read their own boards"
on public.boards
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own boards" on public.boards;
create policy "Users can insert their own boards"
on public.boards
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own boards" on public.boards;
create policy "Users can update their own boards"
on public.boards
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
