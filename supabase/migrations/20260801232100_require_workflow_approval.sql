create or replace function private.assign_workflows_for_approved_agent(
  target_organization_id uuid,
  target_agent_id uuid,
  target_approval_request_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if target_approval_request_id is null then
    raise exception 'Approved request is required';
  end if;

  if not exists (
    select 1 from public.agents a
    where a.id = target_agent_id
      and a.organization_id = target_organization_id
  ) then
    raise exception 'Agent does not belong to organization';
  end if;

  if not exists (
    select 1 from public.agent_approval_requests ar
    where ar.id = target_approval_request_id
      and ar.agent_id = target_agent_id
      and ar.organization_id = target_organization_id
      and ar.status = 'approved'
  ) then
    raise exception 'Approved request is required';
  end if;

  insert into public.agent_workflow_assignments (
    organization_id,
    agent_id,
    workflow_definition_id,
    approval_request_id,
    role,
    status,
    configuration,
    readiness,
    assigned_at
  )
  select
    a.organization_id,
    a.id,
    wd.id,
    target_approval_request_id,
    wd.role,
    'assigned',
    wd.default_configuration,
    jsonb_build_object(
      'definition_ready', wd.status = 'ready',
      'external_workflow_linked', wd.external_workflow_id is not null,
      'endpoint_linked', wd.endpoint_reference is not null,
      'execution_enabled', false
    ),
    now()
  from public.agents a
  join public.workflow_definitions wd
    on wd.agent_type = coalesce(a.agent_type, a.configuration->>'agent_key')
   and wd.status = 'ready'
   and wd.environment = 'production'
   and (
     wd.channel = 'core'
     or exists (
       select 1
       from jsonb_array_elements_text(coalesce(a.communication_channels, '[]'::jsonb)) channel_value
       where channel_value = wd.channel
     )
   )
  where a.id = target_agent_id
    and a.organization_id = target_organization_id
  on conflict (organization_id, agent_id, workflow_definition_id)
  do update set
    approval_request_id = excluded.approval_request_id,
    role = excluded.role,
    configuration = public.agent_workflow_assignments.configuration || excluded.configuration,
    readiness = excluded.readiness,
    status = case when public.agent_workflow_assignments.status = 'disabled' then 'disabled' else 'assigned' end,
    assigned_at = coalesce(public.agent_workflow_assignments.assigned_at, excluded.assigned_at),
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.assign_workflows_for_approved_agent(uuid, uuid, uuid) from public, anon, authenticated;