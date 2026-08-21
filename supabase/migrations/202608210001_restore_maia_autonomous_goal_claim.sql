create or replace function public.claim_next_maia_autonomous_goal()
returns public.agent_runtime_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_goal public.agent_runtime_goals;
begin
  select *
    into claimed_goal
  from public.agent_runtime_goals
  where status = 'queued'
    and (next_run_at is null or next_run_at <= now())
  order by priority desc, coalesce(next_run_at, created_at) asc, created_at asc
  for update skip locked
  limit 1;

  if claimed_goal.id is null then
    return null;
  end if;

  update public.agent_runtime_goals
  set status = 'running', updated_at = now()
  where id = claimed_goal.id
  returning * into claimed_goal;

  return claimed_goal;
end;
$$;

revoke all on function public.claim_next_maia_autonomous_goal() from public;
grant execute on function public.claim_next_maia_autonomous_goal() to service_role;
