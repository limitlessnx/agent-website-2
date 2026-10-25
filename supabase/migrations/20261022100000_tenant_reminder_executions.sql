-- Idempotent execution ledger for the shared tenant reminder engine.
create table if not exists public.tenant_reminder_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null,
  recipient_key text,
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in ('queued','processing','sent','delivered','failed','skipped','blocked','cancelled')),
  channel text not null check (channel in ('internal','whatsapp','email')),
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, rule_id) references public.tenant_reminder_rules(organization_id, id) on delete cascade,
  unique (organization_id, rule_id, recipient_key, scheduled_for)
);
create index if not exists tenant_reminder_executions_due_idx
  on public.tenant_reminder_executions (status, scheduled_for) where status in ('queued','failed');
create index if not exists tenant_reminder_executions_org_created_idx
  on public.tenant_reminder_executions (organization_id, created_at desc);
alter table public.tenant_reminder_executions enable row level security;
revoke all on public.tenant_reminder_executions from public, anon, authenticated;
grant all on public.tenant_reminder_executions to service_role;
comment on table public.tenant_reminder_executions is 'Idempotent tenant-scoped execution ledger for reminders; all provider delivery must revalidate consent and tenant credentials.';
