-- FluxAgents workflow orchestrator foundation
-- Run this migration in the Supabase SQL editor before using the workflow registry dashboard.

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
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'disabled', 'error')),
  current_version integer not null default 1 check (current_version > 0),
  timeout_seconds integer not null default 60 check (timeout_seconds between 5 and 3600),
  max_retries integer not null default 2 check (max_retries between 0 and 10),
  metadata jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workflow_key)
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  organization_id text not null,
  project_id text not null,
  workflow_key text not null,
  provider_run_id text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'timed_out')),
  attempt integer not null default 1 check (attempt > 0),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  error_message text,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  version integer not null check (version > 0),
  configuration jsonb not null default '{}'::jsonb,
  change_note text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (workflow_id, version)
);

create table if not exists public.workflow_webhooks (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_registry(id) on delete cascade,
  webhook_key text not null,
  path text not null,
  secret_hash text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, webhook_key),
  unique (path)
);

create index if not exists workflow_registry_project_idx
  on public.workflow_registry (organization_id, project_id, status);
create index if not exists workflow_runs_workflow_created_idx
  on public.workflow_runs (workflow_id, created_at desc);
create index if not exists workflow_runs_status_created_idx
  on public.workflow_runs (status, created_at desc);

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

drop trigger if exists workflow_webhooks_set_updated_at on public.workflow_webhooks;
create trigger workflow_webhooks_set_updated_at
before update on public.workflow_webhooks
for each row execute function public.set_updated_at();

alter table public.workflow_registry enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_webhooks enable row level security;

-- The Next.js server uses the Supabase service-role key and bypasses RLS.
-- No public policies are created intentionally. Never expose the service-role key to the browser.

comment on table public.workflow_registry is 'Canonical registry of agent and automation workflows across FluxAgents projects.';
comment on table public.workflow_runs is 'Execution history and failure records for registered workflows.';
comment on table public.workflow_versions is 'Versioned workflow configuration snapshots.';
comment on table public.workflow_webhooks is 'Webhook mappings owned by registered workflows.';
