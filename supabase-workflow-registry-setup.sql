create extension if not exists pgcrypto;

create table if not exists public.workflow_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null default 'limitless-realty',
  project_id text not null,
  workflow_key text not null,
  name text not null,
  description text,
  provider text not null default 'n8n',
  external_workflow_id text,
  endpoint_url text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'disabled', 'error')),
  current_version integer not null default 1,
  timeout_seconds integer not null default 60,
  max_retries integer not null default 2,
  metadata jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workflow_key)
);

create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  version integer not null,
  configuration jsonb not null default '{}'::jsonb,
  change_notes text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (workflow_id, version)
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  organization_id text not null,
  project_id text not null,
  workflow_key text not null,
  provider_run_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'timed_out')),
  attempt integer not null default 1,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  error_message text,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_connections (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  connection_key text not null,
  provider text not null,
  credential_reference text,
  status text not null default 'configured' check (status in ('configured', 'missing', 'expired', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, connection_key)
);

create table if not exists public.workflow_errors (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflow_registry(id) on delete cascade,
  run_id uuid references public.workflow_runs(id) on delete cascade,
  error_code text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workflow_registry_project_idx on public.workflow_registry(project_id, status);
create index if not exists workflow_runs_workflow_created_idx on public.workflow_runs(workflow_id, created_at desc);
create index if not exists workflow_runs_status_idx on public.workflow_runs(status, created_at desc);
create index if not exists workflow_errors_unresolved_idx on public.workflow_errors(resolved, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workflow_registry_set_updated_at on public.workflow_registry;
create trigger workflow_registry_set_updated_at
before update on public.workflow_registry
for each row execute function public.set_updated_at();

drop trigger if exists workflow_connections_set_updated_at on public.workflow_connections;
create trigger workflow_connections_set_updated_at
before update on public.workflow_connections
for each row execute function public.set_updated_at();

alter table public.workflow_registry enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_connections enable row level security;
alter table public.workflow_errors enable row level security;

comment on table public.workflow_registry is 'Canonical registry for Fluxknight automations and agents.';
comment on table public.workflow_runs is 'Execution history for registered workflows.';
