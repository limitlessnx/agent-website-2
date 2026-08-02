create extension if not exists pgcrypto;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_key text,
  full_name text,
  email text,
  phone text,
  company text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, external_key)
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  customer_id uuid,
  channel text not null check (channel in ('whatsapp','email','web_chat','telegram','voice')),
  external_thread_key text,
  status text not null default 'open' check (status in ('open','waiting','human_handoff','closed','archived')),
  current_stage text,
  assigned_user_id uuid,
  ai_paused boolean not null default false,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, channel, external_thread_key),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, customer_id) references public.customer_profiles(organization_id, id) on delete set null
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  sender_type text not null check (sender_type in ('customer','agent','human','system','tool')),
  sender_id uuid,
  content_type text not null default 'text',
  content text,
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, conversation_id) references public.agent_conversations(organization_id, id) on delete cascade
);

create table if not exists public.customer_memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  agent_id uuid,
  memory_type text not null check (memory_type in ('fact','preference','summary','goal','objection','interaction')),
  memory_key text not null,
  value jsonb not null,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  source_conversation_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id, agent_id, memory_type, memory_key),
  foreign key (organization_id, customer_id) references public.customer_profiles(organization_id, id) on delete cascade,
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, source_conversation_id) references public.agent_conversations(organization_id, id) on delete set null
);

create table if not exists public.tool_definitions (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null unique,
  display_name text not null,
  description text not null,
  handler_type text not null check (handler_type in ('internal','workflow','approval')),
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  required_permissions text[] not null default '{}',
  timeout_ms integer not null default 30000,
  retry_policy jsonb not null default '{"max_attempts":3}'::jsonb,
  status text not null default 'disabled' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tool_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  tool_id uuid not null references public.tool_definitions(id) on delete cascade,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id, tool_id),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.runtime_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  conversation_id uuid,
  event_id uuid,
  prompt_version integer,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','blocked','cancelled')),
  execution_context jsonb not null default '{}'::jsonb,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  latency_ms integer,
  token_usage jsonb not null default '{}'::jsonb,
  cost_minor bigint not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, conversation_id) references public.agent_conversations(organization_id, id) on delete set null,
  foreign key (organization_id, event_id) references public.domain_events(organization_id, id) on delete set null
);

create table if not exists public.runtime_tool_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  tool_id uuid not null references public.tool_definitions(id),
  status text not null default 'requested' check (status in ('requested','approved','running','succeeded','failed','denied')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create table if not exists public.command_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  execution_id uuid,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','claimed','running','succeeded','failed','dead_letter','cancelled')),
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create table if not exists public.handoff_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  agent_id uuid not null,
  reason text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','assigned','resolved','cancelled')),
  assigned_user_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (organization_id, conversation_id) references public.agent_conversations(organization_id, id) on delete cascade,
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.action_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  tool_call_id uuid,
  action_key text not null,
  request_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  requested_by text not null default 'agent',
  reviewed_by uuid,
  reviewer_notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid,
  execution_id uuid,
  usage_type text not null check (usage_type in ('ai_tokens','voice_seconds','whatsapp_message','email_message','workflow_execution','storage_bytes','api_call')),
  quantity numeric not null,
  unit_cost_minor numeric not null default 0,
  total_cost_minor numeric generated always as (quantity * unit_cost_minor) stored,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete set null
);

create index if not exists idx_conversations_org_status on public.agent_conversations(organization_id, status, last_message_at desc);
create index if not exists idx_messages_conversation on public.conversation_messages(organization_id, conversation_id, created_at);
create index if not exists idx_runtime_queue on public.runtime_executions(status, created_at);
create index if not exists idx_command_queue_claim on public.command_queue(status, available_at, priority, created_at);
create index if not exists idx_usage_org_time on public.usage_ledger(organization_id, occurred_at desc);

alter table public.customer_profiles enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.customer_memories enable row level security;
alter table public.agent_tool_assignments enable row level security;
alter table public.runtime_executions enable row level security;
alter table public.runtime_tool_calls enable row level security;
alter table public.command_queue enable row level security;
alter table public.handoff_requests enable row level security;
alter table public.action_approval_requests enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.tool_definitions enable row level security;

create policy customer_profiles_tenant on public.customer_profiles for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy conversations_tenant on public.agent_conversations for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy messages_tenant on public.conversation_messages for select to authenticated using (public.is_organization_member(organization_id));
create policy memories_tenant on public.customer_memories for select to authenticated using (public.is_organization_member(organization_id));
create policy handoffs_tenant on public.handoff_requests for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy approvals_tenant on public.action_approval_requests for select to authenticated using (public.is_organization_member(organization_id));
create policy usage_tenant on public.usage_ledger for select to authenticated using (public.is_organization_member(organization_id));
create policy assignments_tenant on public.agent_tool_assignments for select to authenticated using (public.is_organization_member(organization_id));
create policy executions_tenant on public.runtime_executions for select to authenticated using (public.is_organization_member(organization_id));

revoke all on public.tool_definitions, public.runtime_tool_calls, public.command_queue from anon, authenticated;

insert into public.tool_definitions (tool_key, display_name, description, handler_type, status)
values
 ('crm.create_lead','Create CRM lead','Create a tenant-owned CRM lead from qualified conversation data.','internal','disabled'),
 ('crm.update_lead','Update CRM lead','Update an existing tenant-owned lead.','internal','disabled'),
 ('calendar.book_appointment','Book appointment','Create an appointment through an approved calendar workflow.','workflow','disabled'),
 ('handoff.request','Request human handoff','Pause AI and request human assistance.','internal','active'),
 ('knowledge.search','Search knowledge','Search the agent tenant knowledge collection.','internal','disabled'),
 ('email.send','Send email','Send an approved email through the organization email connection.','workflow','disabled'),
 ('whatsapp.send','Send WhatsApp message','Send a WhatsApp message through the organization connection.','workflow','disabled')
on conflict (tool_key) do nothing;

create or replace function public.enqueue_agent_execution(
  p_organization_id uuid,
  p_agent_id uuid,
  p_conversation_id uuid,
  p_input jsonb,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_ready boolean;
  v_execution_id uuid;
begin
  select coalesce(is_ready, false) into v_ready from public.agent_readiness_snapshots where organization_id=p_organization_id and agent_id=p_agent_id;
  if not v_ready then raise exception 'Agent is not ready for execution'; end if;
  if p_conversation_id is not null and not exists (select 1 from public.agent_conversations where organization_id=p_organization_id and id=p_conversation_id and agent_id=p_agent_id) then
    raise exception 'Conversation does not belong to agent organization';
  end if;
  insert into public.runtime_executions(organization_id,agent_id,conversation_id,status,input)
  values(p_organization_id,p_agent_id,p_conversation_id,'queued',coalesce(p_input,'{}'::jsonb)) returning id into v_execution_id;
  insert into public.command_queue(organization_id,agent_id,execution_id,command_type,payload,idempotency_key)
  values(p_organization_id,p_agent_id,v_execution_id,'agent.respond',jsonb_build_object('execution_id',v_execution_id),p_idempotency_key);
  return v_execution_id;
end $$;
revoke all on function public.enqueue_agent_execution(uuid,uuid,uuid,jsonb,text) from public, anon, authenticated;
