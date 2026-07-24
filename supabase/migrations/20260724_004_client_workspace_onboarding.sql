create table if not exists public.client_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  membership_id uuid references public.organization_memberships(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'configuration', 'testing', 'awaiting_approval', 'live', 'paused')),
  current_step integer not null default 1 check (current_step between 1 and 5),
  business_name text,
  industry text,
  website text,
  country text,
  timezone text,
  business_email text,
  phone text,
  staff_size text,
  requested_agents jsonb not null default '[]'::jsonb,
  business_goals jsonb not null default '[]'::jsonb,
  channels jsonb not null default '[]'::jsonb,
  existing_tools jsonb not null default '[]'::jsonb,
  human_contact_name text,
  human_contact_email text,
  notes text,
  agent_family_id uuid references public.agent_families(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_onboarding_status_idx
  on public.client_onboarding_profiles(status, created_at desc);

create index if not exists client_onboarding_user_idx
  on public.client_onboarding_profiles(user_id, organization_id);

alter table public.client_onboarding_profiles enable row level security;

drop trigger if exists client_onboarding_profiles_set_updated_at on public.client_onboarding_profiles;
create trigger client_onboarding_profiles_set_updated_at
before update on public.client_onboarding_profiles
for each row execute function public.set_updated_at();

drop policy if exists client_onboarding_member_select on public.client_onboarding_profiles;
create policy client_onboarding_member_select
on public.client_onboarding_profiles
for select
to authenticated
using (public.is_organization_member(organization_id));

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
  v_family_name text;
  v_agent_name text;
  v_family_slug text;
  v_project_slug text;
  v_agent_slug text;
begin
  select * into v_profile
  from public.client_onboarding_profiles
  where organization_id = p_organization_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Onboarding profile not found';
  end if;

  if coalesce(jsonb_array_length(v_profile.requested_agents), 0) = 0 then
    raise exception 'Select at least one AI agent';
  end if;

  if coalesce(jsonb_array_length(v_profile.business_goals), 0) = 0 then
    raise exception 'Select at least one business goal';
  end if;

  select id into v_branch_id
  from public.branches
  where organization_id = p_organization_id
  order by created_at asc
  limit 1;

  v_family_name := coalesce(nullif(v_profile.business_name, ''), 'Business') || ' AI Workforce';
  v_agent_name := case
    when v_profile.requested_agents ? 'ai_sales_agent' then 'Sales AI'
    when v_profile.requested_agents ? 'customer_support_agent' then 'Support AI'
    when v_profile.requested_agents ? 'voice_agent' then 'Voice AI'
    else 'Business AI'
  end;
  v_family_slug := public.slugify_identifier(v_family_name);
  v_project_slug := 'starter-project';
  v_agent_slug := public.slugify_identifier(v_agent_name);

  select id into v_family_id
  from public.agent_families
  where organization_id = p_organization_id
  order by created_at asc
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
        'channels', v_profile.channels
      )
    ) returning id into v_family_id;
  end if;

  select id into v_project_id
  from public.projects
  where organization_id = p_organization_id
    and agent_family_id = v_family_id
  order by created_at asc
  limit 1;

  if v_project_id is null then
    insert into public.projects (
      organization_id, agent_family_id, branch_id, name, slug, description, status, metadata
    ) values (
      p_organization_id,
      v_family_id,
      v_branch_id,
      'Starter AI Project',
      v_project_slug,
      'Initial project generated from client onboarding.',
      'draft',
      jsonb_build_object('goals', v_profile.business_goals, 'tools', v_profile.existing_tools)
    ) returning id into v_project_id;
  end if;

  select id into v_agent_id
  from public.agents
  where project_id = v_project_id
  order by created_at asc
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
        'You are the draft AI assistant for %s. Your selected functions are %s. Your business goals are %s. Use only approved business information, do not guess, and escalate to %s (%s) when human authority is required.',
        coalesce(v_profile.business_name, 'the client organization'),
        v_profile.requested_agents::text,
        v_profile.business_goals::text,
        coalesce(v_profile.human_contact_name, 'the human team'),
        coalesce(v_profile.human_contact_email, v_profile.business_email, 'the configured contact')
      ),
      'draft',
      jsonb_build_object(
        'industry', v_profile.industry,
        'channels', v_profile.channels,
        'existing_tools', v_profile.existing_tools,
        'human_contact', jsonb_build_object(
          'name', v_profile.human_contact_name,
          'email', v_profile.human_contact_email
        )
      )
    ) returning id into v_agent_id;
  end if;

  update public.client_onboarding_profiles
  set status = 'submitted',
      current_step = 5,
      agent_family_id = v_family_id,
      project_id = v_project_id,
      agent_id = v_agent_id,
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
    jsonb_build_object('agent_family_id', v_family_id, 'project_id', v_project_id, 'agent_id', v_agent_id)
  );

  return jsonb_build_object(
    'onboarding_id', v_profile.id,
    'status', 'submitted',
    'agent_family_id', v_family_id,
    'project_id', v_project_id,
    'agent_id', v_agent_id
  );
end;
$$;

revoke all on function public.complete_client_onboarding(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_client_onboarding(uuid, uuid) to service_role;

comment on function public.complete_client_onboarding(uuid, uuid)
is 'Validates onboarding answers and idempotently creates the first draft agent family, project, and agent.';