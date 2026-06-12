-- One row per user: the entire canvas graph ({circles, people, connections})
-- stored as a single JSON blob. Importing thousands of LinkedIn contacts is one
-- upsert instead of thousands of inserts, so there is nothing to rate-limit.
create table if not exists public.user_graphs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  graph jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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

drop trigger if exists user_graphs_set_updated_at on public.user_graphs;
create trigger user_graphs_set_updated_at
before update on public.user_graphs
for each row
execute function public.set_updated_at();

alter table public.user_graphs enable row level security;

drop policy if exists "Users read their own graph" on public.user_graphs;
create policy "Users read their own graph"
on public.user_graphs
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users insert their own graph" on public.user_graphs;
create policy "Users insert their own graph"
on public.user_graphs
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users update their own graph" on public.user_graphs;
create policy "Users update their own graph"
on public.user_graphs
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users delete their own graph" on public.user_graphs;
create policy "Users delete their own graph"
on public.user_graphs
for delete
to authenticated
using (user_id = (select auth.uid()));
