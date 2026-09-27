create or replace function public.provision_selected_agent_allocations(
  p_organization_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_branch_id uuid;
  v_family_id uuid;
  v_project_id uuid;
  v_agent_id uuid;
  v_collection_id uuid;
  v_selection record;
  v_workflow record;
  v_collection record;
  v_agent_slug text;
  v_created integer := 0;
  v_reused integer := 0;
  v_integrations integer := 0;
  v_workflows integer := 0;
  v_bindings integer := 0;
  v_provider text;
  v_channels jsonb;
begin
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found';
  end if;

  select id into v_branch_id
  from public.branches
  where organization_id = p_organization_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    insert into public.branches (organization_id,name,slug,status)
    values (p_organization_id,'Main Branch','main','active')
    returning id into v_branch_id;
  end if;

  select id into v_family_id
  from public.agent_families
  where organization_id = p_organization_id and slug = 'allocated-workforce'
  limit 1;

  if v_family_id is null then
    insert into public.agent_families (
      organization_id, branch_id, name, slug, description, status, configuration
    ) values (
      p_organization_id, v_branch_id, 'Allocated AI Workforce', 'allocated-workforce',
      'Tenant AI workforce created from super-admin agent allocations.', 'draft',
      jsonb_build_object('source','agent_allocation')
    ) returning id into v_family_id;
  end if;

  select id into v_project_id
  from public.projects
  where organization_id = p_organization_id
    and agent_family_id = v_family_id
    and slug = 'allocated-agents'
  limit 1;

  if v_project_id is null then
    insert into public.projects (
      organization_id, agent_family_id, branch_id, name, slug, description, status, metadata
    ) values (
      p_organization_id, v_family_id, v_branch_id, 'Allocated Agents', 'allocated-agents',
      'Tenant agent instances created from approved catalog allocations.', 'draft',
      jsonb_build_object('source','agent_allocation')
    ) returning id into v_project_id;
  end if;

  -- Ensure every client has at least one tenant-owned knowledge collection.
  select id into v_collection_id
  from public.knowledge_collections
  where organization_id = p_organization_id and status = 'active'
  order by created_at asc
  limit 1;

  if v_collection_id is null then
    insert into public.knowledge_collections (
      organization_id,name,slug,description,status,metadata
    ) values (
      p_organization_id,'Business Knowledge','business-knowledge',
      'Primary approved business knowledge for tenant agents.','active',
      jsonb_build_object('provisioning_source','agent_allocation')
    ) returning id into v_collection_id;
  end if;

  for v_selection in
    select id, agent_key, display_name, status, configuration
    from public.organization_agent_selections
    where organization_id = p_organization_id
      and status in ('selected','paid','provisioning','active')
    order by created_at
  loop
    v_agent_id := null;

    select id into v_agent_id
    from public.agents
    where organization_id = p_organization_id
      and configuration ->> 'agent_key' = v_selection.agent_key
    order by created_at asc
    limit 1;

    if v_agent_id is not null then
      v_reused := v_reused + 1;
    else
      v_agent_slug := public.slugify_identifier(v_selection.agent_key);
      v_channels := case
        when v_selection.agent_key = 'whatsapp_agent' then '["whatsapp"]'::jsonb
        when v_selection.agent_key = 'email_automation' then '["email"]'::jsonb
        when v_selection.agent_key in ('voice_receptionist','outbound_call_agent') then '["voice"]'::jsonb
        when v_selection.agent_key = 'appointment_agent' then '["calendar"]'::jsonb
        else '[]'::jsonb
      end;

      insert into public.agents (
        organization_id, agent_family_id, project_id, branch_id,
        name, slug, description, system_prompt, status,
        configuration, agent_type, communication_channels
      ) values (
        p_organization_id, v_family_id, v_project_id, v_branch_id,
        v_selection.display_name, v_agent_slug,
        'Draft tenant agent created from the Fluxknight agent catalog.',
        format('You are the %s for this organization. Use only approved tenant knowledge and connected tenant integrations. Never guess. Respect tenant boundaries and escalate whenever human approval is required.', v_selection.display_name),
        'draft',
        jsonb_build_object(
          'agent_key', v_selection.agent_key,
          'allocation_selection_id', v_selection.id,
          'provisioning_source', 'agent_allocation'
        ),
        v_selection.agent_key,
        v_channels
      )
      returning id into v_agent_id;
      v_created := v_created + 1;
    end if;

    update public.organization_agent_selections
    set status = case when status = 'active' then 'active' else 'provisioning' end,
        configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object(
          'provisioned_agent_id', v_agent_id,
          'provisioned_at', now()
        ),
        updated_at = now()
    where id = v_selection.id;

    -- Bind every active tenant knowledge collection to the allocated agent.
    for v_collection in
      select id from public.knowledge_collections
      where organization_id = p_organization_id and status = 'active'
    loop
      insert into public.agent_knowledge_bindings (
        organization_id,agent_id,collection_id,required,status
      ) values (
        p_organization_id,v_agent_id,v_collection.id,true,'active'
      ) on conflict (organization_id,agent_id,collection_id) do nothing;
      if found then v_bindings := v_bindings + 1; end if;
    end loop;

    -- Assign every ready shared workflow matching this agent type.
    for v_workflow in
      select id,role,workflow_key
      from public.workflow_definitions
      where agent_type = v_selection.agent_key and status = 'ready'
    loop
      insert into public.agent_workflow_assignments (
        organization_id,agent_id,workflow_definition_id,role,status,configuration,readiness,assigned_at
      ) values (
        p_organization_id,v_agent_id,v_workflow.id,coalesce(v_workflow.role,'primary'),'assigned',
        jsonb_build_object('source','agent_allocation','workflow_key',v_workflow.workflow_key),
        jsonb_build_object('state','assigned'),now()
      ) on conflict (organization_id,agent_id,workflow_definition_id) do nothing;
      if found then v_workflows := v_workflows + 1; end if;
    end loop;

    v_provider := case
      when v_selection.agent_key = 'whatsapp_agent' then 'whatsapp'
      when v_selection.agent_key = 'email_automation' then 'email'
      when v_selection.agent_key in ('voice_receptionist','outbound_call_agent') then 'elevenlabs'
      when v_selection.agent_key = 'appointment_agent' then 'google_calendar'
      else null
    end;

    if v_provider is not null then
      insert into public.organization_integrations (
        organization_id, provider, display_name, status, configuration, health
      ) values (
        p_organization_id,
        v_provider,
        initcap(replace(v_provider,'_',' ')),
        'disconnected',
        jsonb_build_object(
          'required_by_agent_allocation', true,
          'agent_key', v_selection.agent_key
        ),
        jsonb_build_object('state','not_checked')
      )
      on conflict (organization_id, provider) do update set
        configuration = coalesce(public.organization_integrations.configuration,'{}'::jsonb) || jsonb_build_object(
          'required_by_agent_allocation', true,
          'agent_key', v_selection.agent_key
        ),
        updated_at = now();
      v_integrations := v_integrations + 1;
    end if;
  end loop;

  insert into public.audit_logs (
    organization_id, branch_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, v_branch_id, p_actor_user_id,
    'organization.agent_allocations_provisioned', 'organization', p_organization_id::text,
    jsonb_build_object(
      'agents_created', v_created,
      'agents_reused', v_reused,
      'workflow_assignments_created', v_workflows,
      'knowledge_bindings_created', v_bindings,
      'integration_requirements_processed', v_integrations,
      'agent_family_id', v_family_id,
      'project_id', v_project_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', p_organization_id,
    'branch_id', v_branch_id,
    'agent_family_id', v_family_id,
    'project_id', v_project_id,
    'agents_created', v_created,
    'agents_reused', v_reused,
    'workflow_assignments_created', v_workflows,
    'knowledge_bindings_created', v_bindings,
    'integration_requirements_processed', v_integrations
  );
end;
$function$;
