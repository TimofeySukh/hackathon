alter table public.user_graphs
add column if not exists revision bigint not null default 1;

create or replace function public.set_user_graph_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' and new.graph is distinct from old.graph then
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists user_graphs_set_updated_at on public.user_graphs;
drop trigger if exists user_graphs_set_metadata on public.user_graphs;
create trigger user_graphs_set_metadata
before update on public.user_graphs
for each row
execute function public.set_user_graph_metadata();

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['graph:read']::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tokens_name_not_blank check (length(btrim(name)) > 0),
  constraint agent_tokens_scopes_not_empty check (cardinality(scopes) > 0)
);

create index if not exists agent_tokens_user_id_idx on public.agent_tokens (user_id);
create index if not exists agent_tokens_token_hash_idx on public.agent_tokens (token_hash);

create or replace function public.set_agent_tokens_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_tokens_set_updated_at on public.agent_tokens;
create trigger agent_tokens_set_updated_at
before update on public.agent_tokens
for each row
execute function public.set_agent_tokens_updated_at();

alter table public.agent_tokens enable row level security;

drop policy if exists "Users read their own agent tokens" on public.agent_tokens;
