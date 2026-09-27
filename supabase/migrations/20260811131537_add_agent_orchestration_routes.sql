create table if not exists public.agent_orchestration_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_agent_id uuid not null,
  source_workflow_definition_id uuid null references public.workflow_definitions(id) on delete set null,
  target_type text not null check (target_type in ('agent','workflow','channel')),
  target_agent_id uuid null,
  target_workflow_definition_id uuid null references public.workflow_definitions(id) on delete set null,
  target_channel text null check (target_channel is null or target_channel in ('whatsapp','web','telegram','email','voice','sms')),
  trigger_event text not null default 'success',
  status text not null default 'active' check (status in ('active','paused')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_orchestration_routes_source_agent_fk foreign key (organization_id, source_agent_id) references public.agents(organization_id,id) on delete cascade,
  constraint agent_orchestration_routes_target_agent_fk foreign key (organization_id, target_agent_id) references public.agents(organization_id,id) on delete cascade,
  constraint agent_orchestration_routes_target_valid check (
    (target_type='agent' and target_agent_id is not null) or
    (target_type='workflow' and target_workflow_definition_id is not null) or
    (target_type='channel' and target_channel is not null)
  )
);
create index if not exists idx_agent_orchestration_routes_org_source on public.agent_orchestration_routes(organization_id,source_agent_id);
create index if not exists idx_agent_orchestration_routes_org_target on public.agent_orchestration_routes(organization_id,target_agent_id);
