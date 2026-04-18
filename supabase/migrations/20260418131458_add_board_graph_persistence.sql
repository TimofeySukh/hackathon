create table if not exists public.board_nodes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  label text not null default '',
  x double precision not null default 0,
  y double precision not null default 0,
  kind text not null default 'default' check (kind in ('root', 'default')),
  note text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_edges (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  from_node_id uuid not null references public.board_nodes (id) on delete cascade,
  to_node_id uuid not null references public.board_nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_edges_no_self_loop check (from_node_id <> to_node_id),
  constraint board_edges_unique_direction unique (board_id, from_node_id, to_node_id)
);

create index if not exists board_nodes_board_id_idx on public.board_nodes (board_id);
create index if not exists board_edges_board_id_idx on public.board_edges (board_id);
create index if not exists board_edges_from_node_id_idx on public.board_edges (from_node_id);
create index if not exists board_edges_to_node_id_idx on public.board_edges (to_node_id);
create unique index if not exists board_nodes_one_root_per_board_idx
  on public.board_nodes (board_id)
  where kind = 'root';

drop trigger if exists board_nodes_set_updated_at on public.board_nodes;
create trigger board_nodes_set_updated_at
before update on public.board_nodes
for each row
execute function public.set_updated_at();

drop trigger if exists board_edges_set_updated_at on public.board_edges;
create trigger board_edges_set_updated_at
before update on public.board_edges
for each row
execute function public.set_updated_at();

alter table public.board_nodes enable row level security;
alter table public.board_edges enable row level security;

drop policy if exists "Users can read their own board nodes" on public.board_nodes;
create policy "Users can read their own board nodes"
on public.board_nodes
for select
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_nodes.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert their own board nodes" on public.board_nodes;
create policy "Users can insert their own board nodes"
on public.board_nodes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_nodes.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their own board nodes" on public.board_nodes;
create policy "Users can update their own board nodes"
on public.board_nodes
for update
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_nodes.board_id
      and boards.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_nodes.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their own board nodes" on public.board_nodes;
create policy "Users can delete their own board nodes"
on public.board_nodes
for delete
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_nodes.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read their own board edges" on public.board_edges;
create policy "Users can read their own board edges"
on public.board_edges
for select
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_edges.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert their own board edges" on public.board_edges;
create policy "Users can insert their own board edges"
on public.board_edges
for insert
to authenticated
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_edges.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their own board edges" on public.board_edges;
create policy "Users can update their own board edges"
on public.board_edges
for update
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_edges.board_id
      and boards.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.boards
    where boards.id = board_edges.board_id
      and boards.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their own board edges" on public.board_edges;
create policy "Users can delete their own board edges"
on public.board_edges
for delete
to authenticated
using (
  exists (
    select 1
    from public.boards
    where boards.id = board_edges.board_id
      and boards.user_id = (select auth.uid())
  )
);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table public.board_nodes;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.board_edges;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
