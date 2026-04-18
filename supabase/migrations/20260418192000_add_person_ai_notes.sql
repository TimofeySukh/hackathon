create table if not exists public.person_ai_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'not_created',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_ai_notes_person_unique unique (person_id),
  constraint person_ai_notes_status_check check (status in ('not_created', 'created'))
);

create index if not exists person_ai_notes_owner_user_id_idx
on public.person_ai_notes (owner_user_id);

drop trigger if exists person_ai_notes_set_updated_at on public.person_ai_notes;
create trigger person_ai_notes_set_updated_at
before update on public.person_ai_notes
for each row
execute function public.set_updated_at();

create or replace function public.validate_person_ai_note_owner()
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
    raise exception 'AI note must belong to the same user as the person.';
  end if;

  return new;
end;
$$;

drop trigger if exists person_ai_notes_validate_owner on public.person_ai_notes;
create trigger person_ai_notes_validate_owner
before insert or update on public.person_ai_notes
for each row
execute function public.validate_person_ai_note_owner();

alter table public.person_ai_notes enable row level security;

drop policy if exists "Users can read their own person AI notes" on public.person_ai_notes;
create policy "Users can read their own person AI notes"
on public.person_ai_notes
for select
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users can insert their own person AI notes" on public.person_ai_notes;
create policy "Users can insert their own person AI notes"
on public.person_ai_notes
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can update their own person AI notes" on public.person_ai_notes;
create policy "Users can update their own person AI notes"
on public.person_ai_notes
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

drop policy if exists "Users can delete their own person AI notes" on public.person_ai_notes;
create policy "Users can delete their own person AI notes"
on public.person_ai_notes
for delete
to authenticated
using (owner_user_id = (select auth.uid()));
