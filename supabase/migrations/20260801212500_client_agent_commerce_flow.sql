begin;

create table if not exists public.organization_agent_selections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_template_id uuid references public.agent_templates(id) on delete restrict,
  agent_key text not null,
  display_name text not null,
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'selected' check (status in ('selected','configured','quoted','payment_pending','paid','provisioning','active','cancelled')),
  setup_price numeric(14,2) not null default 0,
  monthly_price numeric(14,2) not null default 0,
  currency text not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_key),
  unique (organization_id, id)
);

create table if not exists public.organization_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_type text not null default 'standard' check (quote_type in ('standard','custom')),
  status text not null default 'draft' check (status in ('draft','ready','accepted','payment_pending','paid','expired','cancelled')),
  setup_total numeric(14,2) not null default 0,
  monthly_total numeric(14,2) not null default 0,
  currency text not null default 'NGN',
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table if not exists public.custom_agent_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  problem_statement text not null,
  current_process text,
  required_channels text[] not null default '{}',
  required_integrations text[] not null default '{}',
  requirements jsonb not null default '{}'::jsonb,
  budget_range text,
  desired_launch_date date,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','clarification_needed','proposal_ready','proposal_accepted','deposit_pending','in_build','testing','delivered','live','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table if not exists public.organization_quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null,
  agent_selection_id uuid,
  item_type text not null default 'agent' check (item_type in ('agent','channel','usage','setup','discount','custom')),
  item_key text not null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  setup_price numeric(14,2) not null default 0,
  monthly_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  foreign key (organization_id, quote_id) references public.organization_quotes(organization_id, id) on delete cascade,
  foreign key (organization_id, agent_selection_id) references public.organization_agent_selections(organization_id, id) on delete set null
);

create table if not exists public.custom_agent_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  custom_request_id uuid not null,
  scope text not null,
  deliverables jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  setup_price numeric(14,2) not null default 0,
  monthly_price numeric(14,2) not null default 0,
  currency text not null default 'NGN',
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, custom_request_id) references public.custom_agent_requests(organization_id, id) on delete cascade
);

alter table public.organization_agent_selections enable row level security;
alter table public.organization_quotes enable row level security;
alter table public.organization_quote_items enable row level security;
alter table public.custom_agent_requests enable row level security;
alter table public.custom_agent_proposals enable row level security;

create policy "members_manage_agent_selections" on public.organization_agent_selections for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy "members_view_quotes" on public.organization_quotes for select to authenticated using (public.is_organization_member(organization_id));
create policy "members_view_quote_items" on public.organization_quote_items for select to authenticated using (public.is_organization_member(organization_id));
create policy "members_manage_custom_requests" on public.custom_agent_requests for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id) and submitted_by = auth.uid());
create policy "members_view_custom_proposals" on public.custom_agent_proposals for select to authenticated using (public.is_organization_member(organization_id));

create index if not exists organization_agent_selections_org_status_idx on public.organization_agent_selections(organization_id, status);
create index if not exists organization_quotes_org_status_idx on public.organization_quotes(organization_id, status);
create index if not exists custom_agent_requests_org_status_idx on public.custom_agent_requests(organization_id, status);

commit;
