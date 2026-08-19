create table if not exists public.agent_runtime_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  enabled boolean not null default true,
  autonomy_mode text not null default 'autonomous',
  max_steps integer not null default 8,
  model_strategy text not null default 'best_available',
  memory_enabled boolean not null default true,
  tool_policy jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id),
  check (autonomy_mode in ('supervised','autonomous')),
  check (max_steps between 1 and 20),
  check (model_strategy in ('best_available','fastest','reasoning','balanced'))
);
create table if not exists public.agent_runtime_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade, channel text not null default 'web', external_conversation_id text,
  status text not null default 'active', context jsonb not null default '{}'::jsonb, last_model_id uuid references public.ai_model_catalog(id) on delete set null,
  step_count integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists agent_runtime_sessions_scope_idx on public.agent_runtime_sessions(organization_id, agent_id, updated_at desc);
create table if not exists public.agent_runtime_messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade, session_id uuid not null references public.agent_runtime_sessions(id) on delete cascade,
  role text not null, content text, tool_name text, tool_call_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists agent_runtime_messages_session_idx on public.agent_runtime_messages(session_id, created_at);
create table if not exists public.agent_runtime_tool_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade, session_id uuid references public.agent_runtime_sessions(id) on delete set null,
  tool_name text not null, input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb,
  status text not null default 'completed', approval_required boolean not null default false, started_at timestamptz not null default now(), finished_at timestamptz
);
create index if not exists agent_runtime_tool_runs_scope_idx on public.agent_runtime_tool_runs(organization_id, agent_id, started_at desc);
create table if not exists public.agent_runtime_goals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade, title text not null, goal_type text not null default 'autonomous',
  priority integer not null default 50, status text not null default 'queued', input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb,
  next_run_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists agent_runtime_goals_queue_idx on public.agent_runtime_goals(status, next_run_at, priority desc, created_at);
create index if not exists agent_runtime_goals_scope_idx on public.agent_runtime_goals(organization_id, agent_id, status);
create table if not exists public.agent_runtime_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade, event_type text not null, payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued', created_at timestamptz not null default now()
);
create index if not exists agent_runtime_events_scope_idx on public.agent_runtime_events(organization_id, agent_id, created_at desc);
alter table public.agent_runtime_profiles enable row level security;
alter table public.agent_runtime_sessions enable row level security;
alter table public.agent_runtime_messages enable row level security;
alter table public.agent_runtime_tool_runs enable row level security;
alter table public.agent_runtime_goals enable row level security;
alter table public.agent_runtime_events enable row level security;
