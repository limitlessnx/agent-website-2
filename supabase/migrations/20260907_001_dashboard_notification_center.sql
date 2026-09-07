create table if not exists public.dashboard_notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audience text not null default 'customer' check (audience in ('customer','admin','both')),
  category text not null,
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  title text not null,
  message text not null,
  action_label text,
  action_href text,
  source text not null default 'lifecycle',
  persistent boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_notification_reads (
  notification_id uuid not null references public.dashboard_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists dashboard_notifications_org_created_idx
  on public.dashboard_notifications (organization_id, created_at desc);

create index if not exists dashboard_notifications_org_active_idx
  on public.dashboard_notifications (organization_id, resolved_at, expires_at, severity, created_at desc);

create index if not exists dashboard_notification_reads_user_idx
  on public.dashboard_notification_reads (user_id, read_at desc);

alter table public.dashboard_notifications enable row level security;
alter table public.dashboard_notification_reads enable row level security;

revoke all on public.dashboard_notifications from anon, authenticated;
revoke all on public.dashboard_notification_reads from anon, authenticated;

grant all on public.dashboard_notifications to service_role;
grant all on public.dashboard_notification_reads to service_role;

comment on table public.dashboard_notifications is 'Durable dashboard-first lifecycle notifications. Email delivery remains in client_delivery_notifications / transactional email tables.';
comment on table public.dashboard_notification_reads is 'Per-user read receipts for dashboard notifications.';
