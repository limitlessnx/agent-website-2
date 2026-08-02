-- Phase 10: tenant runtime configuration

-- Composite tenant keys required by child tables.
do $$ begin
  alter table public.knowledge_collections
    add constraint knowledge_collections_org_id_id_key unique (organization_id, id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.organization_integrations
    add constraint organization_integrations_org_id_id_key unique (organization_id, id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.workflow_definitions
    add constraint workflow_definitions_id_key unique (id);
exception when duplicate_object then null; end $$;

create table if not exists public.agent_prompt_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  block_key text not null,
  title text not null,
  content text not null default '',
  sort_order integer not null default 100,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  version integer not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id, block_key),
  foreign key (organization_id, agent_id)
    references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  version integer not null,
  assembled_prompt text not null,
  blocks_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft','published','retired')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, agent_id, version),
  foreign key (organization_id, agent_id)
    references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.agent_knowledge_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  collection_id uuid not null,
  required boolean not null default true,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id, collection_id),
  foreign key (organization_id, agent_id)
    references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, collection_id)
    references public.knowledge_collections(organization_id, id) on delete cascade
);

create table if not exists public.organization_integration_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  channel text not null check (channel in ('whatsapp','email','web_chat','telegram','voice','calendar')),
  integration_id uuid,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','connected','error','waived')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id, channel),
  foreign key (organization_id, agent_id)
    references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, integration_id)
    references public.organization_integrations(organization_id, id) on delete set null
);

create table if not exists public.agent_runtime_readiness (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  business_profile_ready boolean not null default false,
  prompt_ready boolean not null default false,
  knowledge_ready boolean not null default false,
  integrations_ready boolean not null default false,
  test_ready boolean not null default false,
  approval_ready boolean not null default false,
  workflow_ready boolean not null default false,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  blockers jsonb not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now(),
  primary key (organization_id, agent_id),
  foreign key (organization_id, agent_id)
    references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid,
  event_type text not null,
  source text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','published','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id),
  foreign key (organization_id, agent_id)
    references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  status text not null default 'disabled' check (status in ('active','disabled')),
  filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, workflow_definition_id)
);

create table if not exists public.event_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.domain_events(id) on delete cascade,
  subscription_id uuid not null references public.event_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed')),
  attempt integer not null default 1,
  response jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, subscription_id, attempt)
);

create index if not exists agent_prompt_blocks_agent_idx
  on public.agent_prompt_blocks(organization_id, agent_id, sort_order);
create index if not exists agent_knowledge_bindings_agent_idx
  on public.agent_knowledge_bindings(organization_id, agent_id);
create index if not exists integration_requirements_agent_idx
  on public.organization_integration_requirements(organization_id, agent_id, status);
create index if not exists domain_events_dispatch_idx
  on public.domain_events(status, available_at, created_at);

alter table public.agent_prompt_blocks enable row level security;
alter table public.agent_prompt_versions enable row level security;
alter table public.agent_knowledge_bindings enable row level security;
alter table public.organization_integration_requirements enable row level security;
alter table public.agent_runtime_readiness enable row level security;
alter table public.domain_events enable row level security;
alter table public.event_subscriptions enable row level security;
alter table public.event_delivery_attempts enable row level security;

revoke all on public.domain_events, public.event_subscriptions, public.event_delivery_attempts from anon, authenticated;
grant select, insert, update, delete on public.agent_prompt_blocks to authenticated;
grant select on public.agent_prompt_versions to authenticated;
grant select, insert, update, delete on public.agent_knowledge_bindings to authenticated;
grant select on public.organization_integration_requirements to authenticated;
grant select on public.agent_runtime_readiness to authenticated;

create policy "Members manage own prompt blocks"
on public.agent_prompt_blocks for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members read own prompt versions"
on public.agent_prompt_versions for select to authenticated
using (public.is_organization_member(organization_id));

create policy "Members manage own knowledge bindings"
on public.agent_knowledge_bindings for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "Members read own integration requirements"
on public.organization_integration_requirements for select to authenticated
using (public.is_organization_member(organization_id));

create policy "Members read own runtime readiness"
on public.agent_runtime_readiness for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function private.refresh_agent_runtime_readiness(
  target_organization_id uuid,
  target_agent_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  business_ok boolean;
  prompt_ok boolean;
  knowledge_ok boolean;
  integrations_ok boolean;
  test_ok boolean;
  approval_ok boolean;
  workflow_ok boolean;
  score integer;
  missing jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1 from public.agents a
    where a.organization_id = target_organization_id and a.id = target_agent_id
  ) then raise exception 'Agent does not belong to organization'; end if;

  select (coalesce(o.name,'') <> '' and jsonb_typeof(o.metadata) = 'object')
    into business_ok from public.organizations o where o.id = target_organization_id;

  select exists(
    select 1 from public.agent_prompt_blocks b
    where b.organization_id = target_organization_id
      and b.agent_id = target_agent_id
      and b.status = 'active'
      and length(trim(b.content)) > 0
  ) or exists(
    select 1 from public.agents a
    where a.organization_id = target_organization_id
      and a.id = target_agent_id
      and length(trim(coalesce(a.system_prompt,''))) > 0
  ) into prompt_ok;

  select exists(
    select 1
    from public.agent_knowledge_bindings b
    join public.knowledge_sources s
      on s.organization_id = b.organization_id
     and s.collection_id = b.collection_id
     and s.status in ('ready','active','processed')
    where b.organization_id = target_organization_id
      and b.agent_id = target_agent_id
      and b.status = 'active'
  ) into knowledge_ok;

  select not exists(
    select 1 from public.organization_integration_requirements r
    where r.organization_id = target_organization_id
      and r.agent_id = target_agent_id
      and r.required = true
      and r.status not in ('connected','waived')
  ) into integrations_ok;

  select exists(
    select 1 from public.agent_test_runs t
    where t.organization_id = target_organization_id
      and t.agent_id = target_agent_id
      and t.status = 'passed'
  ) into test_ok;

  select exists(
    select 1 from public.agent_approval_requests ar
    where ar.organization_id = target_organization_id
      and ar.agent_id = target_agent_id
      and ar.status = 'approved'
  ) into approval_ok;

  select exists(
    select 1 from public.agent_workflow_assignments wa
    where wa.organization_id = target_organization_id
      and wa.agent_id = target_agent_id
      and wa.status in ('assigned','ready')
  ) into workflow_ok;

  if not business_ok then missing := missing || '"business_profile"'::jsonb; end if;
  if not prompt_ok then missing := missing || '"prompt"'::jsonb; end if;
  if not knowledge_ok then missing := missing || '"knowledge"'::jsonb; end if;
  if not integrations_ok then missing := missing || '"integrations"'::jsonb; end if;
  if not test_ok then missing := missing || '"testing"'::jsonb; end if;
  if not approval_ok then missing := missing || '"approval"'::jsonb; end if;
  if not workflow_ok then missing := missing || '"workflow"'::jsonb; end if;

  score := ((business_ok::int + prompt_ok::int + knowledge_ok::int + integrations_ok::int + test_ok::int + approval_ok::int + workflow_ok::int) * 100) / 7;

  insert into public.agent_runtime_readiness(
    organization_id, agent_id, business_profile_ready, prompt_ready, knowledge_ready,
    integrations_ready, test_ready, approval_ready, workflow_ready, readiness_score,
    blockers, refreshed_at
  ) values (
    target_organization_id, target_agent_id, business_ok, prompt_ok, knowledge_ok,
    integrations_ok, test_ok, approval_ok, workflow_ok, score, missing, now()
  ) on conflict (organization_id, agent_id) do update set
    business_profile_ready = excluded.business_profile_ready,
    prompt_ready = excluded.prompt_ready,
    knowledge_ready = excluded.knowledge_ready,
    integrations_ready = excluded.integrations_ready,
    test_ready = excluded.test_ready,
    approval_ready = excluded.approval_ready,
    workflow_ready = excluded.workflow_ready,
    readiness_score = excluded.readiness_score,
    blockers = excluded.blockers,
    refreshed_at = now();

  return score;
end;
$$;

create or replace function private.assemble_agent_prompt(
  target_organization_id uuid,
  target_agent_id uuid,
  actor_user_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
  assembled text;
  snapshot jsonb;
begin
  if not exists (
    select 1 from public.agents a
    where a.organization_id = target_organization_id and a.id = target_agent_id
  ) then raise exception 'Agent does not belong to organization'; end if;

  select string_agg(format('## %s\n%s', title, content), E'\n\n' order by sort_order, block_key),
         jsonb_agg(jsonb_build_object('key',block_key,'title',title,'content',content,'order',sort_order) order by sort_order, block_key)
    into assembled, snapshot
  from public.agent_prompt_blocks
  where organization_id = target_organization_id
    and agent_id = target_agent_id
    and status = 'active';

  if assembled is null or length(trim(assembled)) = 0 then
    raise exception 'At least one active prompt block is required';
  end if;

  select coalesce(max(version),0)+1 into next_version
  from public.agent_prompt_versions
  where organization_id = target_organization_id and agent_id = target_agent_id;

  update public.agent_prompt_versions set status='retired'
  where organization_id = target_organization_id and agent_id = target_agent_id and status='published';

  insert into public.agent_prompt_versions(organization_id,agent_id,version,assembled_prompt,blocks_snapshot,status,created_by)
  values(target_organization_id,target_agent_id,next_version,assembled,coalesce(snapshot,'[]'::jsonb),'published',actor_user_id);

  update public.agents
  set system_prompt = assembled, current_version = next_version, updated_at = now()
  where organization_id = target_organization_id and id = target_agent_id;

  perform private.refresh_agent_runtime_readiness(target_organization_id,target_agent_id);
  return next_version;
end;
$$;

revoke all on function private.refresh_agent_runtime_readiness(uuid,uuid) from public, anon, authenticated;
revoke all on function private.assemble_agent_prompt(uuid,uuid,uuid) from public, anon, authenticated;

-- Create integration requirements from each agent's selected capabilities.
insert into public.organization_integration_requirements(organization_id, agent_id, channel, required, status)
select a.organization_id, a.id, c.channel, true,
       case when exists(
         select 1 from public.organization_integrations oi
         where oi.organization_id = a.organization_id
           and oi.provider = c.channel
           and oi.status = 'connected'
       ) then 'connected' else 'pending' end
from public.agents a
cross join lateral (
  select value #>> '{}' as channel
  from jsonb_array_elements(coalesce(a.communication_channels,'[]'::jsonb)) value
) c
where c.channel in ('whatsapp','email','web_chat','telegram','voice','calendar')
on conflict (organization_id,agent_id,channel) do nothing;
