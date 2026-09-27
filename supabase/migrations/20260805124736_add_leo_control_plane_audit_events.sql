create table if not exists public.support_action_events (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.support_actions(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  event_type text not null check (event_type in ('proposed','approved','rejected','executing','verified','completed','failed','rollback_started','rolled_back','rollback_failed')),
  actor text null,
  before_state jsonb null,
  after_state jsonb null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_action_events_action_idx on public.support_action_events(action_id, created_at);
create index if not exists support_action_events_org_idx on public.support_action_events(organization_id, created_at);
alter table public.support_action_events enable row level security;
