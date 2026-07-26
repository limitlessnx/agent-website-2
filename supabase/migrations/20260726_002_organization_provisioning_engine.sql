create or replace function public.provision_organization_template(
  p_organization_id uuid,
  p_template_slug text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_template public.organization_templates%rowtype;
  v_assignment_id uuid;
  v_branch_id uuid;
  v_family_id uuid;
  v_project_id uuid;
  v_agent_id uuid;
  v_item text;
  v_name text;
  v_slug text;
  v_agents_created integer := 0;
  v_workflows_created integer := 0;
  v_collections_created integer := 0;
  v_integrations_created integer := 0;
begin
  select * into v_template
  from public.organization_templates
  where slug = p_template_slug and status = 'active'
  limit 1;

  if not found then
    raise exception 'Active organization template not found: %', p_template_slug;
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found';
  end if;

  insert into public.organization_template_assignments (
    organization_id, template_id, status, metadata
  ) values (
    p_organization_id, v_template.id, 'provisioning',
    jsonb_build_object('template_slug', v_template.slug, 'started_at', now())
  )
  on conflict (organization_id, template_id) do update set
    status = 'provisioning',
    metadata = coalesce(public.organization_template_assignments.metadata, '{}'::jsonb) ||
      jsonb_build_object('template_slug', v_template.slug, 'started_at', now(), 'last_error', null),
    updated_at = now()
  returning id into v_assignment_id;

  select id into v_branch_id
  from public.branches
  where organization_id = p_organization_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    insert into public.branches (organization_id, name, slug, status, metadata)
    values (p_organization_id, 'Main Branch', 'main', 'active', jsonb_build_object('provisioned_by', v_template.slug))
    returning id into v_branch_id;
  end if;

  v_name := v_template.name;
  v_slug := public.slugify_identifier(v_template.slug || '-workforce');

  select id into v_family_id
  from public.agent_families
  where organization_id = p_organization_id and slug = v_slug
  limit 1;

  if v_family_id is null then
    insert into public.agent_families (
      organization_id, branch_id, name, slug, description, status, configuration
    ) values (
      p_organization_id, v_branch_id, v_name, v_slug,
      coalesce(v_template.description, 'Provisioned Fluxknight AI workforce.'),
      'draft',
      jsonb_build_object('template_id', v_template.id, 'template_slug', v_template.slug, 'modules', v_template.modules)
    ) returning id into v_family_id;
  end if;

  select id into v_project_id
  from public.projects
  where organization_id = p_organization_id and agent_family_id = v_family_id and slug = 'platform-starter'
  limit 1;

  if v_project_id is null then
    insert into public.projects (
      organization_id, agent_family_id, branch_id, name, slug, description, status, metadata
    ) values (
      p_organization_id, v_family_id, v_branch_id, 'Platform Starter', 'platform-starter',
      'Starter project provisioned from an organization template.', 'draft',
      jsonb_build_object('template_id', v_template.id, 'template_slug', v_template.slug, 'modules', v_template.modules)
    ) returning id into v_project_id;
  end if;

  for v_item in select distinct value from jsonb_array_elements_text(v_template.agents)
  loop
    v_name := initcap(replace(v_item, '_', ' '));
    v_slug := public.slugify_identifier(v_name);

    select id into v_agent_id
    from public.agents
    where project_id = v_project_id and slug = v_slug
    limit 1;

    if v_agent_id is null then
      insert into public.agents (
        organization_id, agent_family_id, project_id, branch_id,
        name, slug, description, system_prompt, status, configuration
      ) values (
        p_organization_id, v_family_id, v_project_id, v_branch_id,
        v_name, v_slug,
        'Draft agent provisioned from the ' || v_template.name || ' template.',
        format('You are the %s for this organization. Use only approved organization knowledge, never guess, respect permissions, and escalate whenever human approval is required.', v_name),
        'draft',
        jsonb_build_object('agent_key', v_item, 'template_id', v_template.id, 'template_slug', v_template.slug)
      );
      v_agents_created := v_agents_created + 1;
    end if;
  end loop;

  for v_item in select distinct value from jsonb_array_elements_text(v_template.workflows)
  loop
    insert into public.workflow_registry (
      organization_id, project_id, organization_uuid, branch_id, agent_family_id, project_uuid,
      workflow_key, name, description, provider, trigger_type, environment, status,
      current_version, timeout_seconds, max_retries, metadata
    ) values (
      v_template.slug, 'platform-starter', p_organization_id, v_branch_id, v_family_id, v_project_id,
      v_item, initcap(replace(v_item, '_', ' ')),
      'Draft workflow provisioned from the ' || v_template.name || ' template.',
      'n8n', 'webhook', 'production', 'draft', 1, 60, 2,
      jsonb_build_object('template_id', v_template.id, 'template_slug', v_template.slug)
    )
    on conflict do nothing;
    if found then v_workflows_created := v_workflows_created + 1; end if;
  end loop;

  for v_item in select distinct value from jsonb_array_elements_text(v_template.knowledge_structure)
  loop
    insert into public.knowledge_collections (
      organization_id, name, slug, description, status, metadata
    ) values (
      p_organization_id, v_item, public.slugify_identifier(v_item),
      v_item || ' knowledge collection provisioned by Fluxknight.', 'active',
      jsonb_build_object('template_id', v_template.id, 'template_slug', v_template.slug)
    )
    on conflict (organization_id, slug) do nothing;
    if found then v_collections_created := v_collections_created + 1; end if;
  end loop;

  for v_item in select distinct value from jsonb_array_elements_text(v_template.integration_requirements)
  loop
    insert into public.organization_integrations (
      organization_id, provider, display_name, status, configuration, health
    ) values (
      p_organization_id, v_item, initcap(replace(v_item, '_', ' ')), 'disconnected',
      jsonb_build_object('required_by_template', true, 'template_slug', v_template.slug),
      jsonb_build_object('state', 'not_checked')
    )
    on conflict (organization_id, provider) do nothing;
    if found then v_integrations_created := v_integrations_created + 1; end if;
  end loop;

  update public.organization_template_assignments
  set status = 'active', provisioned_at = now(), updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'completed_at', now(),
        'branch_id', v_branch_id,
        'agent_family_id', v_family_id,
        'project_id', v_project_id,
        'agents_created', v_agents_created,
        'workflows_created', v_workflows_created,
        'knowledge_collections_created', v_collections_created,
        'integrations_created', v_integrations_created
      )
  where id = v_assignment_id;

  insert into public.audit_logs (
    organization_id, branch_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, v_branch_id, p_actor_user_id,
    'organization.template_provisioned', 'organization_template_assignment', v_assignment_id::text,
    jsonb_build_object(
      'template_id', v_template.id,
      'template_slug', v_template.slug,
      'agent_family_id', v_family_id,
      'project_id', v_project_id,
      'agents_created', v_agents_created,
      'workflows_created', v_workflows_created,
      'knowledge_collections_created', v_collections_created,
      'integrations_created', v_integrations_created
    )
  );

  return jsonb_build_object(
    'ok', true,
    'assignment_id', v_assignment_id,
    'template_id', v_template.id,
    'template_slug', v_template.slug,
    'branch_id', v_branch_id,
    'agent_family_id', v_family_id,
    'project_id', v_project_id,
    'agents_created', v_agents_created,
    'workflows_created', v_workflows_created,
    'knowledge_collections_created', v_collections_created,
    'integrations_created', v_integrations_created
  );
exception when others then
  if v_assignment_id is not null then
    update public.organization_template_assignments
    set status = 'failed', updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_error', sqlerrm, 'failed_at', now())
    where id = v_assignment_id;
  end if;
  raise;
end;
$$;

revoke all on function public.provision_organization_template(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.provision_organization_template(uuid, text, uuid) to service_role;

comment on function public.provision_organization_template(uuid, text, uuid)
is 'Idempotently provisions an organization template into branches, agent assets, workflow records, knowledge collections, integrations and audit history.';