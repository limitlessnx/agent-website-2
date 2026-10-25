create table if not exists public.tenant_reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null,
  execution_id uuid not null,
  title text not null,
  body text not null default '',
  status text not null default 'unread' check (status in ('unread','read','dismissed')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (organization_id, rule_id) references public.tenant_reminder_rules(organization_id, id) on delete cascade,
  foreign key (organization_id, execution_id) references public.tenant_reminder_executions(organization_id, id) on delete cascade,
  unique (organization_id, execution_id)
);
create index if not exists tenant_reminder_notifications_inbox_idx
  on public.tenant_reminder_notifications (organization_id, status, created_at desc);
alter table public.tenant_reminder_notifications enable row level security;
revoke all on public.tenant_reminder_notifications from public, anon, authenticated;
grant all on public.tenant_reminder_notifications to service_role;
