create table if not exists public.organization_follow_up_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  organization_key text null,
  name text not null,
  status text not null default 'active' check (status in ('draft','active','paused','archived')),
  timezone text not null default 'Africa/Lagos',
  preferred_send_time time not null default '10:30',
  qualification jsonb not null default '{}'::jsonb,
  sequence jsonb not null default '[]'::jsonb,
  stop_conditions jsonb not null default '[]'::jsonb,
  channel_policy jsonb not null default '{}'::jsonb,
  message_strategy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_follow_up_policy_scope check (organization_id is not null or nullif(trim(organization_key),'') is not null)
);

create unique index if not exists organization_follow_up_policies_org_uidx
  on public.organization_follow_up_policies(organization_id)
  where organization_id is not null;
create unique index if not exists organization_follow_up_policies_key_uidx
  on public.organization_follow_up_policies(lower(organization_key))
  where organization_key is not null;

alter table public.organization_follow_up_policies enable row level security;
