create table if not exists public.node_groups (
  id text not null,
  board_id uuid not null references public.boards (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  member_ids text[] not null,
  color text not null check (length(trim(color)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint node_groups_members_count_check check (cardinality(member_ids) >= 2),
  constraint node_groups_board_id_id_key primary key (board_id, id)
);

create index if not exists node_groups_board_id_idx on public.node_groups (board_id);
create index if not exists node_groups_owner_user_id_idx on public.node_groups (owner_user_id);

drop trigger if exists node_groups_set_updated_at on public.node_groups;
create trigger node_groups_set_updated_at
before update on public.node_groups
for each row
execute function public.set_updated_at();

create or replace function public.validate_node_group_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from unnest(new.member_ids) as member_id
    group by member_id
    having count(*) > 1
  ) then
    raise exception 'Node group members must be distinct.';
  end if;

  if exists (
    select 1
    from unnest(new.member_ids) as member_id
    where not exists (
      select 1
      from public.people
      where people.id::text = member_id
        and people.board_id = new.board_id
        and people.owner_user_id = new.owner_user_id
        and people.is_root = false
    )
  ) then
    raise exception 'Node group members must belong to the same non-root board people.';
  end if;

  return new;
end;
$$;

drop trigger if exists node_groups_validate_membership_trigger on public.node_groups;
create trigger node_groups_validate_membership_trigger
before insert or update on public.node_groups
for each row
execute function public.validate_node_group_membership();

alter table public.node_groups enable row level security;

drop policy if exists "Users can read their own node groups" on public.node_groups;
create policy "Users can read their own node groups"
on public.node_groups
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can insert their own node groups" on public.node_groups;
create policy "Users can insert their own node groups"
on public.node_groups
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can delete their own node groups" on public.node_groups;
create policy "Users can delete their own node groups"
on public.node_groups
for delete
to authenticated
using (owner_user_id = (select auth.uid()));
