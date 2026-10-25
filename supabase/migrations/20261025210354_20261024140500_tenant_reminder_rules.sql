-- Shared reminder rule model for all tenant workspaces.
-- Delivery executions are stored separately so retries can be idempotent.
create table if not exists public.tenant_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 140),
  description text not null default '',
  trigger_type text not null check (trigger_type in ('date','recurring','event')),
  event_key text,
  anchor_field text,
  schedule_config jsonb not null default '{}'::jsonb check (jsonb_typeof(schedule_config) = 'object'),
  audience_config jsonb not null default '{}'::jsonb check (jsonb_typeof(audience_config) = 'object'),
  channel text not null default 'internal' check (channel in ('internal','whatsapp','email')),
  message_mode text not null default 'template' check (message_mode in ('template','ai')),
  message_template text not null default '',
  timezone text not null default 'Africa/Lagos',
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (
    (trigger_type = 'date' and (anchor_field is not null or schedule_config ? 'date'))
    or (trigger_type = 'recurring' and schedule_config ? 'frequency')
    or (trigger_type = 'event' and event_key is not null)
  )
);
create index if not exists tenant_reminder_rules_org_status_idx
  on public.tenant_reminder_rules (organization_id, status, created_at desc);
create index if not exists tenant_reminder_rules_org_type_idx
  on public.tenant_reminder_rules (organization_id, trigger_type, status);
alter table public.tenant_reminder_rules enable row level security;
revoke all on public.tenant_reminder_rules from public, anon, authenticated;
grant all on public.tenant_reminder_rules to service_role;
comment on table public.tenant_reminder_rules is 'Tenant-scoped reusable reminder definitions. Delivery execution must validate tenant, consent, and provider readiness independently.';
