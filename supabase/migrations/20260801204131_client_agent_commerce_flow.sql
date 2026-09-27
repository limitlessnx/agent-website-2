begin;

create schema if not exists private;

create table if not exists public.agent_catalog_offerings (
  agent_key text primary key,
  display_name text not null,
  setup_price numeric(14,2) not null check (setup_price >= 0),
  monthly_price numeric(14,2) not null check (monthly_price >= 0),
  currency text not null default 'NGN',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.agent_catalog_offerings (agent_key, display_name, setup_price, monthly_price, currency)
values
  ('ai_sales_agent', 'AI Sales Agent', 250000, 100000, 'NGN'),
  ('customer_support_agent', 'Customer Support Agent', 220000, 90000, 'NGN'),
  ('whatsapp_agent', 'WhatsApp Agent', 180000, 75000, 'NGN'),
  ('appointment_agent', 'Appointment Agent', 150000, 60000, 'NGN'),
  ('email_automation', 'Email Follow-up Agent', 180000, 70000, 'NGN'),
  ('voice_receptionist', 'Voice Receptionist', 350000, 150000, 'NGN'),
  ('outbound_call_agent', 'Outbound Call Agent', 400000, 180000, 'NGN'),
  ('crm_followup_agent', 'CRM Follow-up Agent', 200000, 80000, 'NGN')
on conflict (agent_key) do update set
  display_name = excluded.display_name,
  setup_price = excluded.setup_price,
  monthly_price = excluded.monthly_price,
  currency = excluded.currency,
  is_active = true,
  updated_at = now();

create table if not exists public.organization_agent_selections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_template_id uuid references public.agent_templates(id) on delete restrict,
  agent_key text not null references public.agent_catalog_offerings(agent_key) on delete restrict,
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
  foreign key (organization_id, agent_selection_id) references public.organization_agent_selections(organization_id, id) on delete restrict
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

create or replace function private.apply_agent_catalog_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering public.agent_catalog_offerings%rowtype;
begin
  select * into offering
  from public.agent_catalog_offerings
  where agent_key = new.agent_key and is_active = true;

  if offering.agent_key is null then
    raise exception 'Unknown or inactive agent offering: %', new.agent_key;
  end if;

  new.display_name := offering.display_name;
  new.setup_price := offering.setup_price;
  new.monthly_price := offering.monthly_price;
  new.currency := offering.currency;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.apply_agent_catalog_pricing() from public, anon, authenticated;

drop trigger if exists organization_agent_selection_catalog_pricing on public.organization_agent_selections;
create trigger organization_agent_selection_catalog_pricing
before insert or update of agent_key, display_name, setup_price, monthly_price, currency
on public.organization_agent_selections
for each row execute function private.apply_agent_catalog_pricing();

alter table public.agent_catalog_offerings enable row level security;
alter table public.organization_agent_selections enable row level security;
alter table public.organization_quotes enable row level security;
alter table public.organization_quote_items enable row level security;
alter table public.custom_agent_requests enable row level security;
alter table public.custom_agent_proposals enable row level security;

drop policy if exists "authenticated_view_active_agent_catalog" on public.agent_catalog_offerings;
create policy "authenticated_view_active_agent_catalog"
on public.agent_catalog_offerings for select to authenticated
using (is_active = true);

drop policy if exists "members_manage_agent_selections" on public.organization_agent_selections;
create policy "members_manage_agent_selections"
on public.organization_agent_selections for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "members_view_quotes" on public.organization_quotes;
create policy "members_view_quotes"
on public.organization_quotes for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "members_view_quote_items" on public.organization_quote_items;
create policy "members_view_quote_items"
on public.organization_quote_items for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "members_manage_custom_requests" on public.custom_agent_requests;
create policy "members_manage_custom_requests"
on public.custom_agent_requests for all to authenticated
using (public.is_organization_member(organization_id) and submitted_by = auth.uid())
with check (public.is_organization_member(organization_id) and submitted_by = auth.uid());

drop policy if exists "members_view_custom_proposals" on public.custom_agent_proposals;
create policy "members_view_custom_proposals"
on public.custom_agent_proposals for select to authenticated
using (public.is_organization_member(organization_id));

create index if not exists organization_agent_selections_org_status_idx on public.organization_agent_selections(organization_id, status);
create index if not exists organization_quotes_org_status_idx on public.organization_quotes(organization_id, status);
create index if not exists custom_agent_requests_org_status_idx on public.custom_agent_requests(organization_id, status);

commit;
