create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null,
  name text not null,
  description text,
  provider text not null default 'n8n',
  agent_type text not null,
  channel text not null,
  role text not null default 'primary',
  trigger_type text not null default 'webhook',
  environment text not null default 'production',
  external_workflow_id text,
  endpoint_reference text,
  contract_version integer not null default 1,
  input_contract jsonb not null default '{}'::jsonb,
  output_contract jsonb not null default '{}'::jsonb,
  default_configuration jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','disabled','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_key, contract_version, environment)
);

create table if not exists public.agent_workflow_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete restrict,
  approval_request_id uuid,
  role text not null default 'primary',
  status text not null default 'pending' check (status in ('pending','assigned','ready','disabled','error')),
  configuration jsonb not null default '{}'::jsonb,
  readiness jsonb not null default '{}'::jsonb,
  assigned_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id, workflow_definition_id),
  foreign key (organization_id, agent_id)
    references public.agents (organization_id, id) on delete cascade,
  foreign key (organization_id, approval_request_id)
    references public.agent_approval_requests (organization_id, id) on delete set null
);

create index if not exists agent_workflow_assignments_org_agent_idx
  on public.agent_workflow_assignments (organization_id, agent_id);
create index if not exists workflow_definitions_match_idx
  on public.workflow_definitions (agent_type, channel, role, environment, status);

alter table public.workflow_definitions enable row level security;
alter table public.agent_workflow_assignments enable row level security;

revoke all on public.workflow_definitions from anon;
revoke all on public.agent_workflow_assignments from anon;
grant select on public.workflow_definitions to authenticated;
grant select on public.agent_workflow_assignments to authenticated;

create policy "Authenticated users read ready workflow definitions"
on public.workflow_definitions for select
to authenticated
using (status in ('ready','disabled'));

create policy "Members read own workflow assignments"
on public.agent_workflow_assignments for select
to authenticated
using (public.is_organization_member(organization_id));

create or replace function private.assign_workflows_for_approved_agent(
  target_organization_id uuid,
  target_agent_id uuid,
  target_approval_request_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if not exists (
    select 1 from public.agents a
    where a.id = target_agent_id
      and a.organization_id = target_organization_id
  ) then
    raise exception 'Agent does not belong to organization';
  end if;

  if target_approval_request_id is not null and not exists (
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

insert into public.workflow_definitions (
  workflow_key, name, description, provider, agent_type, channel, role, trigger_type,
  environment, contract_version, input_contract, output_contract, default_configuration, status
)
values
  ('shared.crm.lead_capture', 'Shared CRM lead capture', 'Creates or updates tenant-scoped customers and leads.', 'n8n', 'ai_sales_agent', 'core', 'crm', 'internal_event', 'production', 1,
   '{"required":["request_id","organization_id","agent_id","event_type","customer"]}'::jsonb,
   '{"required":["customer_id","lead_id","status"]}'::jsonb,
   '{"execution_enabled":false}'::jsonb, 'ready'),
  ('shared.whatsapp.inbound', 'Shared WhatsApp inbound router', 'Routes verified WhatsApp messages to the assigned tenant agent.', 'n8n', 'whatsapp_agent', 'whatsapp', 'primary', 'webhook', 'production', 1,
   '{"required":["request_id","phone_number_id","external_message_id","sender","message"]}'::jsonb,
   '{"required":["conversation_id","message_id","reply_status"]}'::jsonb,
   '{"execution_enabled":false}'::jsonb, 'ready'),
  ('shared.email.followup', 'Shared email follow-up engine', 'Runs tenant-scoped email sequence steps and stop rules.', 'n8n', 'email_automation', 'email', 'primary', 'scheduled', 'production', 1,
   '{"required":["request_id","organization_id","agent_id","sequence_id","customer_id"]}'::jsonb,
   '{"required":["delivery_id","status","next_step_at"]}'::jsonb,
   '{"execution_enabled":false}'::jsonb, 'ready'),
  ('shared.voice.inbound', 'Shared inbound voice router', 'Routes inbound calls by destination number to the correct tenant agent.', 'n8n', 'voice_receptionist', 'voice', 'primary', 'webhook', 'production', 1,
   '{"required":["request_id","destination_number","provider_call_id"]}'::jsonb,
   '{"required":["call_id","agent_id","status"]}'::jsonb,
   '{"execution_enabled":false}'::jsonb, 'ready'),
  ('shared.voice.outbound', 'Shared outbound call orchestrator', 'Places authorised outbound calls and records outcomes.', 'n8n', 'outbound_call_agent', 'voice', 'primary', 'job', 'production', 1,
   '{"required":["request_id","organization_id","agent_id","customer_id","call_reason"]}'::jsonb,
   '{"required":["call_id","provider_call_id","status"]}'::jsonb,
   '{"execution_enabled":false}'::jsonb, 'ready'),
  ('shared.crm.followup', 'Shared CRM follow-up scheduler', 'Creates and processes tenant-scoped follow-up tasks.', 'n8n', 'crm_followup_agent', 'core', 'primary', 'scheduled', 'production', 1,
   '{"required":["request_id","organization_id","agent_id","task_id"]}'::jsonb,
   '{"required":["task_id","status","next_action"]}'::jsonb,
   '{"execution_enabled":false}'::jsonb, 'ready')
on conflict (workflow_key, contract_version, environment) do nothing;