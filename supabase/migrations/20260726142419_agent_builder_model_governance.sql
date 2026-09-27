alter table public.agents alter column ai_model drop default;
alter table public.agents alter column ai_model drop not null;

comment on column public.agents.ai_model is 'Deprecated compatibility field. Runtime model is resolved from organization_ai_model_assignments and may only be governed by the super admin.';

create or replace function public.agent_organization_has_active_model(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_ai_model_assignments a
    join public.ai_model_catalog m on m.id = a.model_id
    where a.organization_id = target_organization_id
      and m.status = 'active'
  );
$$;

revoke all on function public.agent_organization_has_active_model(uuid) from public, anon, authenticated;
grant execute on function public.agent_organization_has_active_model(uuid) to service_role;
