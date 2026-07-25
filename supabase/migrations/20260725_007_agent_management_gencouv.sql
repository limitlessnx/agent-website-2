alter table if exists public.agents
  add column if not exists agent_type text,
  add column if not exists ai_model text not null default 'gpt-4.1-mini',
  add column if not exists temperature numeric(3,2) not null default 0.30,
  add column if not exists language text not null default 'English',
  add column if not exists voice_provider text,
  add column if not exists communication_channels jsonb not null default '[]'::jsonb,
  add column if not exists escalation_rules jsonb not null default '[]'::jsonb,
  add column if not exists human_handoff_destination jsonb not null default '{}'::jsonb,
  add column if not exists knowledge_sources jsonb not null default '[]'::jsonb;

alter table if exists public.agents
  drop constraint if exists agents_temperature_check;
alter table if exists public.agents
  add constraint agents_temperature_check check (temperature >= 0 and temperature <= 2);

create table if not exists public.agent_workflow_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  role text not null default 'connected',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, workflow_id)
);

create index if not exists agent_workflow_links_agent_idx on public.agent_workflow_links(agent_id);
create index if not exists agent_workflow_links_workflow_idx on public.agent_workflow_links(workflow_id);
create index if not exists agents_project_status_idx on public.agents(project_id, status);
create index if not exists agents_agent_type_idx on public.agents(agent_type);

update public.agents
set
  agent_type = coalesce(agent_type, configuration->>'agent_key', 'custom_agent'),
  ai_model = coalesce(nullif(ai_model, ''), configuration->>'ai_model', 'gpt-4.1-mini'),
  language = coalesce(nullif(language, ''), configuration->>'language', 'English'),
  voice_provider = coalesce(voice_provider, configuration->>'voice_provider'),
  communication_channels = case
    when jsonb_array_length(communication_channels) > 0 then communication_channels
    when jsonb_typeof(configuration->'channels') = 'array' then configuration->'channels'
    else '[]'::jsonb
  end,
  escalation_rules = case
    when jsonb_array_length(escalation_rules) > 0 then escalation_rules
    else '["Low confidence", "Payment approval", "Legal or compliance question", "Customer requests a human"]'::jsonb
  end,
  human_handoff_destination = case
    when human_handoff_destination <> '{}'::jsonb then human_handoff_destination
    when jsonb_typeof(configuration->'human_contact') = 'object' then configuration->'human_contact'
    else '{}'::jsonb
  end
where true;

do $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_family_id uuid;
  v_project_id uuid;
  v_agent_id uuid;
  v_workflow_id uuid;
  v_agent record;
  v_workflow record;
begin
  select id into v_org_id from public.organizations where slug = 'fluxknight' limit 1;
  if v_org_id is null then return; end if;

  select id into v_branch_id from public.branches where organization_id = v_org_id order by created_at limit 1;

  insert into public.agent_families (organization_id, branch_id, name, slug, description, status, configuration)
  values (
    v_org_id, v_branch_id, 'Gencouv Ecosystem', 'gencouv',
    'Trading and investor onboarding automation ecosystem managed through Fluxknight.',
    'active', '{"brand":"Gencouv","channels":["Telegram","WhatsApp","Email"]}'::jsonb
  )
  on conflict (organization_id, slug) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    configuration = coalesce(public.agent_families.configuration, '{}'::jsonb) || excluded.configuration
  returning id into v_family_id;

  insert into public.projects (organization_id, agent_family_id, branch_id, name, slug, description, status, metadata)
  values (
    v_org_id, v_family_id, v_branch_id, 'Gencouv Client Acquisition', 'client-acquisition',
    'Lead generation, onboarding, education, qualification and follow-up for the Gencouv ecosystem.',
    'active', '{"brand":"Gencouv","primary_channel":"Telegram"}'::jsonb
  )
  on conflict (agent_family_id, slug) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    metadata = coalesce(public.projects.metadata, '{}'::jsonb) || excluded.metadata
  returning id into v_project_id;

  for v_agent in select * from (values
    ('gencouv-onboarding-agent','Gencouv Onboarding Agent','onboarding_agent','Qualifies prospects, explains access options and moves suitable clients to the next step.','Telegram','["Telegram","WhatsApp"]'::jsonb),
    ('gencouv-lead-generation-agent','Gencouv Lead Generation Agent','lead_generation_agent','Runs approved Apify lead searches and prepares verified prospect records.','', '["Dashboard","HTTP"]'::jsonb),
    ('gencouv-email-automation-agent','Gencouv Email Automation Agent','email_automation_agent','Runs compliant email sequences, follow-ups and reply classification.','', '["Email","Dashboard"]'::jsonb),
    ('gencouv-crm-orchestrator','Gencouv CRM Orchestrator','crm_orchestrator','Connects lead generation, onboarding, email activity and human handoff through Supabase.','', '["Dashboard","HTTP"]'::jsonb)
  ) as t(slug,name,agent_type,description,voice_provider,channels)
  loop
    insert into public.agents (
      organization_id, agent_family_id, project_id, branch_id, name, slug, description,
      system_prompt, status, agent_type, ai_model, temperature, language, voice_provider,
      communication_channels, escalation_rules, human_handoff_destination, knowledge_sources, configuration
    ) values (
      v_org_id, v_family_id, v_project_id, v_branch_id, v_agent.name, v_agent.slug, v_agent.description,
      format('You are %s for Gencouv. Use only verified Gencouv information. Never promise returns, never guess, clearly explain risk, and escalate payment, legal, compliance, account-access, or suitability decisions to the Gencouv human team.', v_agent.name),
      'draft', v_agent.agent_type, 'gpt-4.1-mini', 0.25, 'English', nullif(v_agent.voice_provider, ''),
      v_agent.channels,
      '["Low confidence", "Financial suitability decision", "Payment or account access", "Legal or compliance request", "Customer requests a human"]'::jsonb,
      '{"type":"team","label":"Gencouv human team","email":"support@gencouv.com"}'::jsonb,
      '[{"type":"website","label":"Gencouv website","value":"gencouv.com"},{"type":"catalog","label":"Approved Gencouv offers","value":"Supabase catalog"}]'::jsonb,
      jsonb_build_object('agent_key', v_agent.agent_type, 'channels', v_agent.channels, 'brand', 'Gencouv')
    )
    on conflict (project_id, slug) do update set
      name = excluded.name,
      description = excluded.description,
      agent_type = excluded.agent_type,
      communication_channels = excluded.communication_channels,
      human_handoff_destination = excluded.human_handoff_destination
    returning id into v_agent_id;
  end loop;

  for v_workflow in select * from (values
    ('gencouv-telegram-onboarding','Gencouv Telegram Onboarding','Telegram qualification and onboarding agent.','telegram_trigger'),
    ('gencouv-apify-lead-generation','Gencouv Apify Lead Generation','Runs approved lead-generation actors and saves normalized leads.','webhook'),
    ('gencouv-email-sequence','Gencouv Email Sequence','Runs the three-step outbound and follow-up sequence.','webhook'),
    ('gencouv-reply-classification','Gencouv Reply Classification','Classifies replies, buyer intent and human handoff requirements.','email_trigger'),
    ('gencouv-crm-sync','Gencouv CRM Sync','Synchronizes leads, activity and campaign status with Supabase.','webhook')
  ) as w(workflow_key,name,description,trigger_type)
  loop
    insert into public.workflow_registry (
      organization_id, project_id, organization_uuid, branch_id, agent_family_id, project_uuid,
      workflow_key, name, description, provider, trigger_type, environment, status,
      current_version, timeout_seconds, max_retries, metadata
    ) values (
      'gencouv', 'client-acquisition', v_org_id, v_branch_id, v_family_id, v_project_id,
      v_workflow.workflow_key, v_workflow.name, v_workflow.description, 'n8n', v_workflow.trigger_type,
      'production', 'draft', 1, 120, 2, '{"ecosystem":"Gencouv","managed_by":"Fluxknight"}'::jsonb
    )
    on conflict (organization_id, workflow_key) do update set
      name = excluded.name,
      description = excluded.description,
      project_id = excluded.project_id,
      organization_uuid = excluded.organization_uuid,
      branch_id = excluded.branch_id,
      agent_family_id = excluded.agent_family_id,
      project_uuid = excluded.project_uuid,
      metadata = coalesce(public.workflow_registry.metadata, '{}'::jsonb) || excluded.metadata
    returning id into v_workflow_id;
  end loop;
end $$;