create or replace function public.refresh_agent_runtime_readiness(
  p_organization_id uuid,
  p_agent_id uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
begin
  return private.refresh_agent_runtime_readiness(p_organization_id, p_agent_id);
end;
$$;

revoke all on function public.refresh_agent_runtime_readiness(uuid,uuid)
from public, anon, authenticated;

grant execute on function public.refresh_agent_runtime_readiness(uuid,uuid)
to service_role;
