-- Browser graph saves send large jsonb payloads. A dedicated RPC keeps the write
-- path stable for bulk LinkedIn imports and avoids brittle PostgREST PATCH bodies.
create or replace function public.save_user_graph(
  p_graph jsonb,
  p_expected_revision bigint default null
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_expected_revision is null then
    insert into public.user_graphs (user_id, graph)
    values (v_user_id, p_graph)
    returning revision into v_revision;
  else
    update public.user_graphs
    set graph = p_graph
    where user_id = v_user_id
      and revision = p_expected_revision
    returning revision into v_revision;

    if v_revision is null then
      raise exception 'Revision conflict' using errcode = 'P0001';
    end if;
  end if;

  return v_revision;
exception
  when unique_violation then
    raise exception 'Revision conflict' using errcode = 'P0001';
end;
$$;

revoke all on function public.save_user_graph(jsonb, bigint) from public;
grant execute on function public.save_user_graph(jsonb, bigint) to authenticated;
