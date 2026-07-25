create or replace function public.complete_client_onboarding(
  p_organization_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.client_onboarding_profiles%rowtype;
  v_branch_id uuid;
  v_family_id uuid;
  v_project_id uuid;
  v_agent_id uuid;
  v_first_agent_id uuid;
  v_agent_ids jsonb := '[]'::jsonb;
  v_agent_key text;
  v_agent_name text;
  v_agent_slug text;
  v_family_name text;
  v_family_slug text;
begin
  select * into v_profile
  from public.client_onboarding_profiles
  where organization_id = p_organization_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Onboarding profile not found';
  end if;

  if nullif(trim(coalesce(v_profile.business_name, '')), '') is null then
    raise exception 'Business name is required';
  end if;

  if nullif(trim(coalesce(v_profile.industry, '')), '') is null then
    raise exception 'Industry is required';
  end if;

  if jsonb_typeof(v_profile.requested_agents) <> 'array'
     or jsonb_array_length(v_profile.requested_agents) = 0 then
    raise exception 'Select at least one AI agent';
  end if;

  if jsonb_typeof(v_profile.business_goals) <> 'array'
     or jsonb_array_length(v_profile.business_goals) = 0 then
    raise exception 'Select at least one business goal';
  end if;

  if nullif(trim(coalesce(v_profile.human_contact_email, '')), '') is null then
    raise exception 'A human contact email is required';
  end if;

  select id into v_branch_id
  from public.branches
  where organization_id = p_organization_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    insert into public.branches (organization_id, name, slug, status, metadata)
    values (p_organization_id, 'Main Branch', 'main', 'active', '{}'::jsonb)
    returning id into v_branch_id;
  end if;

  v_family_name := trim(v_profile.business_name) || ' AI Workforce';
  v_family_slug := public.slugify_identifier(v_family_name);

  select id into v_family_id
  from public.agent_families
  where organization_id = p_organization_id
    and slug = v_family_slug
  limit 1;

  if v_family_id is null then
    insert into public.agent_families (
      organization_id, branch_id, name, slug, description, status, configuration
    ) values (
      p_organization_id,
      v_branch_id,
      v_family_name,
      v_family_slug,
      'Agent family generated from client onboarding.',
      'draft',
      jsonb_build_object(
        'industry', v_profile.industry,
        'requested_agents', v_profile.requested_agents,
        'channels', v_profile.channels,
        'onboarding_profile_id', v_profile.id
      )
    ) returning id into v_family_id;
  else
    update public.agent_families
    set name = v_family_name,
        branch_id = coalesce(branch_id, v_branch_id),
        configuration = coalesce(configuration, '{}'::jsonb) || jsonb_build_object(
          'industry', v_profile.industry,
          'requested_agents', v_profile.requested_agents,
          'channels', v_profile.channels,
          'onboarding_profile_id', v_profile.id
        )
    where id = v_family_id;
  end if;

  select id into v_project_id
  from public.projects
  where organization_id = p_organization_id
    and agent_family_id = v_family_id
    and slug = 'starter-project'
  limit 1;

  if v_project_id is null then
    insert into public.projects (
      organization_id, agent_family_id, branch_id, name, slug, description, status, metadata
    ) values (
      p_organization_id,
      v_family_id,
      v_branch_id,
      'Starter AI Project',
      'starter-project',
      'Initial project generated from client onboarding.',
      'draft',
      jsonb_build_object(
        'goals', v_profile.business_goals,
        'tools', v_profile.existing_tools,
        'channels', v_profile.channels,
        'onboarding_profile_id', v_profile.id
      )
    ) returning id into v_project_id;
  else
    update public.projects
    set branch_id = coalesce(branch_id, v_branch_id),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'goals', v_profile.business_goals,
          'tools', v_profile.existing_tools,
          'channels', v_profile.channels,
          'onboarding_profile_id', v_profile.id
        )
    where id = v_project_id;
  end if;

  for v_agent_key in
    select distinct value
    from jsonb_array_elements_text(v_profile.requested_agents)
  loop
    v_agent_name := case v_agent_key
      when 'ai_sales_agent' then 'AI Sales Agent'
      when 'customer_support_agent' then 'Customer Support Agent'
      when 'whatsapp_agent' then 'WhatsApp Agent'
      when 'voice_agent' then 'Voice Agent'
      when 'lead_generation_agent' then 'Lead Generation Agent'
      when 'email_automation' then 'Email Automation Agent'
      when 'crm_automation' then 'CRM Automation Agent'
      when 'custom_workflow' then 'Custom Workflow Agent'
      else initcap(replace(v_agent_key, '_', ' '))
    end;
    v_agent_slug := public.slugify_identifier(v_agent_name);

    select id into v_agent_id
    from public.agents
    where project_id = v_project_id
      and slug = v_agent_slug
    limit 1;

    if v_agent_id is null then
      insert into public.agents (
        organization_id, agent_family_id, project_id, branch_id,
        name, slug, description, system_prompt, status, configuration
      ) values (
        p_organization_id,
        v_family_id,
        v_project_id,
        v_branch_id,
        v_agent_name,
        v_agent_slug,
        'Draft AI employee generated from onboarding answers.',
        format(
          'You are the draft %s for %s. Support these business goals: %s. Operate only through approved channels: %s. Use only verified business information, never guess, and escalate to %s (%s) whenever confidence, policy, payment, legal authority, or human approval is required.',
          v_agent_name,
          v_profile.business_name,
          v_profile.business_goals::text,
          v_profile.channels::text,
          coalesce(nullif(v_profile.human_contact_name, ''), 'the human team'),
          v_profile.human_contact_email
        ),
        'draft',
        jsonb_build_object(
          'agent_key', v_agent_key,
          'industry', v_profile.industry,
          'channels', v_profile.channels,
          'existing_tools', v_profile.existing_tools,
          'business_goals', v_profile.business_goals,
          'human_contact', jsonb_build_object(
            'name', v_profile.human_contact_name,
            'email', v_profile.human_contact_email
          ),
          'onboarding_profile_id', v_profile.id
        )
      ) returning id into v_agent_id;
    else
      update public.agents
      set name = v_agent_name,
          branch_id = coalesce(branch_id, v_branch_id),
          configuration = coalesce(configuration, '{}'::jsonb) || jsonb_build_object(
            'agent_key', v_agent_key,
            'industry', v_profile.industry,
            'channels', v_profile.channels,
            'existing_tools', v_profile.existing_tools,
            'business_goals', v_profile.business_goals,
            'human_contact', jsonb_build_object(
              'name', v_profile.human_contact_name,
              'email', v_profile.human_contact_email
            ),
            'onboarding_profile_id', v_profile.id
          )
      where id = v_agent_id;
    end if;

    if v_first_agent_id is null then
      v_first_agent_id := v_agent_id;
    end if;
    v_agent_ids := v_agent_ids || jsonb_build_array(v_agent_id);
  end loop;

  update public.client_onboarding_profiles
  set status = 'submitted',
      current_step = 5,
      agent_family_id = v_family_id,
      project_id = v_project_id,
      agent_id = v_first_agent_id,
      completed_at = coalesce(completed_at, now())
  where id = v_profile.id;

  insert into public.audit_logs (
    organization_id, branch_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_organization_id,
    v_branch_id,
    p_user_id,
    'client.onboarding_completed',
    'client_onboarding_profile',
    v_profile.id::text,
    jsonb_build_object(
      'agent_family_id', v_family_id,
      'project_id', v_project_id,
      'agent_ids', v_agent_ids,
      'requested_agents', v_profile.requested_agents
    )
  );

  return jsonb_build_object(
    'onboarding_id', v_profile.id,
    'status', 'submitted',
    'agent_family_id', v_family_id,
    'project_id', v_project_id,
    'agent_id', v_first_agent_id,
    'agent_ids', v_agent_ids,
    'agents_created', jsonb_array_length(v_agent_ids)
  );
end;
$$;

revoke all on function public.complete_client_onboarding(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_client_onboarding(uuid, uuid) to service_role;

comment on function public.complete_client_onboarding(uuid, uuid)
is 'Validates onboarding and idempotently provisions a branch, one agent family, one starter project, and every requested draft agent.';
