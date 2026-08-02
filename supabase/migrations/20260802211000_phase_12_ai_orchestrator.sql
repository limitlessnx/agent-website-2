create extension if not exists pgcrypto;

create table if not exists public.runtime_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  agent_id uuid not null,
  conversation_id uuid,
  prompt_version integer,
  compiled_prompt text not null,
  memory_snapshot jsonb not null default '[]'::jsonb,
  knowledge_snapshot jsonb not null default '[]'::jsonb,
  tool_snapshot jsonb not null default '[]'::jsonb,
  policy_snapshot jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, execution_id),
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade,
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, conversation_id) references public.agent_conversations(organization_id, id) on delete set null
);

create table if not exists public.runtime_retrieval_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  source_type text not null check (source_type in ('memory','knowledge')),
  source_id uuid,
  rank integer not null,
  score numeric,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create table if not exists public.runtime_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  decision_key text not null,
  outcome text not null check (outcome in ('allow','deny','approval_required','limit')),
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create table if not exists public.runtime_model_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  provider_assignment_id uuid,
  status text not null default 'prepared' check (status in ('prepared','sent','streaming','succeeded','failed','cancelled')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create table if not exists public.runtime_progress_events (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  event_type text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, execution_id) references public.runtime_executions(organization_id, id) on delete cascade
);

create index if not exists idx_runtime_retrieval_execution on public.runtime_retrieval_results(organization_id, execution_id, source_type, rank);
create index if not exists idx_runtime_policy_execution on public.runtime_policy_decisions(organization_id, execution_id, created_at);
create index if not exists idx_runtime_progress_execution on public.runtime_progress_events(organization_id, execution_id, id);

alter table public.runtime_context_snapshots enable row level security;
alter table public.runtime_retrieval_results enable row level security;
alter table public.runtime_policy_decisions enable row level security;
alter table public.runtime_model_requests enable row level security;
alter table public.runtime_progress_events enable row level security;

create policy runtime_context_tenant on public.runtime_context_snapshots for select to authenticated using (public.is_organization_member(organization_id));
create policy runtime_retrieval_tenant on public.runtime_retrieval_results for select to authenticated using (public.is_organization_member(organization_id));
create policy runtime_policy_tenant on public.runtime_policy_decisions for select to authenticated using (public.is_organization_member(organization_id));
create policy runtime_progress_tenant on public.runtime_progress_events for select to authenticated using (public.is_organization_member(organization_id));

revoke all on public.runtime_model_requests from anon, authenticated;

create or replace function public.prepare_runtime_context(p_execution_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_exec public.runtime_executions%rowtype;
  v_agent public.agents%rowtype;
  v_prompt text;
  v_prompt_version integer;
  v_memories jsonb;
  v_knowledge jsonb;
  v_tools jsonb;
  v_policy jsonb;
  v_snapshot_id uuid;
begin
  select * into v_exec from public.runtime_executions where id = p_execution_id;
  if not found then raise exception 'Execution not found'; end if;
  select * into v_agent from public.agents where id=v_exec.agent_id and organization_id=v_exec.organization_id;
  if not found then raise exception 'Agent tenant mismatch'; end if;
  select assembled_prompt, version into v_prompt, v_prompt_version
  from public.agent_prompt_versions
  where organization_id=v_exec.organization_id and agent_id=v_exec.agent_id
  order by version desc limit 1;
  if coalesce(v_prompt,'')='' then raise exception 'Published prompt not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',memory_type,'key',memory_key,'value',value,'confidence',confidence) order by updated_at desc),'[]'::jsonb)
  into v_memories from (select * from public.customer_memories where organization_id=v_exec.organization_id and agent_id=v_exec.agent_id order by updated_at desc limit 20) m;

  select coalesce(jsonb_agg(jsonb_build_object('id',ks.id,'title',ks.title,'type',ks.source_type,'content',left(coalesce(ks.content,''),2000))),'[]'::jsonb)
  into v_knowledge
  from public.agent_knowledge_bindings b join public.knowledge_sources ks on ks.organization_id=b.organization_id and ks.id=b.knowledge_source_id
  where b.organization_id=v_exec.organization_id and b.agent_id=v_exec.agent_id and b.enabled=true and ks.status='ready';

  select coalesce(jsonb_agg(jsonb_build_object('key',td.tool_key,'name',td.display_name,'handler',td.handler_type,'input_schema',td.input_schema)),'[]'::jsonb)
  into v_tools
  from public.agent_tool_assignments a join public.tool_definitions td on td.id=a.tool_id
  where a.organization_id=v_exec.organization_id and a.agent_id=v_exec.agent_id and a.enabled=true and td.status='active';

  v_policy := jsonb_build_object('readiness_required',true,'external_execution_enabled',false,'approval_required_for',jsonb_build_array('refund','discount','delete','contract'));

  insert into public.runtime_context_snapshots(organization_id,execution_id,agent_id,conversation_id,prompt_version,compiled_prompt,memory_snapshot,knowledge_snapshot,tool_snapshot,policy_snapshot,checksum)
  values(v_exec.organization_id,v_exec.id,v_exec.agent_id,v_exec.conversation_id,v_prompt_version,v_prompt,v_memories,v_knowledge,v_tools,v_policy,encode(digest(v_prompt || v_memories::text || v_knowledge::text || v_tools::text,'sha256'),'hex'))
  on conflict (organization_id,execution_id) do update set prompt_version=excluded.prompt_version,compiled_prompt=excluded.compiled_prompt,memory_snapshot=excluded.memory_snapshot,knowledge_snapshot=excluded.knowledge_snapshot,tool_snapshot=excluded.tool_snapshot,policy_snapshot=excluded.policy_snapshot,checksum=excluded.checksum
  returning id into v_snapshot_id;

  update public.runtime_executions set execution_context=jsonb_build_object('snapshot_id',v_snapshot_id,'prompt_version',v_prompt_version), prompt_version=v_prompt_version where id=v_exec.id;
  insert into public.runtime_progress_events(organization_id,execution_id,event_type,message) values(v_exec.organization_id,v_exec.id,'context.prepared','Runtime context prepared');
  return v_snapshot_id;
end $$;

revoke all on function public.prepare_runtime_context(uuid) from public, anon, authenticated;
