-- Security regression checks for the Hackathon board schema.
--
-- Run this in a Supabase SQL session after migrations. It checks the static
-- database posture that protects browser-accessed graph data.

do $$
declare
  table_name text;
  missing_tables text[];
begin
  select array_agg(format('%I.%I', schemaname, tablename))
  into missing_tables
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'boards',
      'tags',
      'people',
      'notes',
      'connections',
      'person_ai_notes'
    )
    and not rowsecurity;

  if missing_tables is not null then
    raise exception 'RLS is disabled on: %', array_to_string(missing_tables, ', ');
  end if;

  foreach table_name in array array[
    'profiles',
    'boards',
    'tags',
    'people',
    'notes',
    'connections',
    'person_ai_notes'
  ]
  loop
    if has_table_privilege('anon', format('public.%I', table_name), 'select')
      or has_table_privilege('anon', format('public.%I', table_name), 'insert')
      or has_table_privilege('anon', format('public.%I', table_name), 'update')
      or has_table_privilege('anon', format('public.%I', table_name), 'delete') then
      raise exception 'anon has direct privileges on public.%', table_name;
    end if;
  end loop;
end $$;

do $$
declare
  policy_count integer;
begin
  select count(*)
  into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'boards',
      'tags',
      'people',
      'notes',
      'connections',
      'person_ai_notes'
    )
    and roles @> array['authenticated']::name[];

  if policy_count < 22 then
    raise exception 'Expected authenticated RLS policies are missing. Found only % policies.', policy_count;
  end if;
end $$;
