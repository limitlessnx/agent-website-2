begin;

create table if not exists public.agent_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  initiated_by uuid,
  test_type text not null default 'conversation' check (test_type in ('conversation','integration','handoff','policy')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','passed','failed','cancelled')),
  score numeric,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade
);

create table if not exists public.agent_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  requested_by uuid,
  reviewed_by uuid,
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','rejected')),
  readiness_snapshot jsonb not null default '{}'::jsonb,
  client_notes text,
  reviewer_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade
);

create unique index if not exists agent_approval_one_open_request
on public.agent_approval_requests(organization_id, agent_id)
where status in ('draft','submitted','changes_requested');

alter table public.agent_test_runs enable row level security;
alter table public.agent_approval_requests enable row level security;

create policy "members_view_agent_tests" on public.agent_test_runs
for select to authenticated using (public.is_organization_member(organization_id));
create policy "members_create_agent_tests" on public.agent_test_runs
for insert to authenticated with check (public.is_organization_member(organization_id));

create policy "members_view_agent_approvals" on public.agent_approval_requests
for select to authenticated using (public.is_organization_member(organization_id));
create policy "members_create_agent_approvals" on public.agent_approval_requests
for insert to authenticated with check (public.is_organization_member(organization_id));
create policy "members_update_agent_approvals" on public.agent_approval_requests
for update to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

commit;
