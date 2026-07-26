create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  installation_fee numeric(14,2) not null default 0,
  recurring_fee numeric(14,2) not null default 0,
  currency text not null default 'NGN',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','quarterly','yearly','custom')),
  included_modules jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft','active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  package_id uuid references public.service_packages(id) on delete restrict,
  purchaser_email text not null,
  payment_provider text,
  payment_reference text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','waived')),
  payment_confirmed_at timestamptz,
  access_token_hash text not null,
  status text not null default 'payment_received' check (status in (
    'payment_received','draft','submitted','under_review','provisioning','internal_testing','live','maintenance','suspended','cancelled'
  )),
  current_step smallint not null default 1 check (current_step between 1 and 6),
  business_information jsonb not null default '{}'::jsonb,
  business_services jsonb not null default '{}'::jsonb,
  communication_details jsonb not null default '{}'::jsonb,
  automation_requirements jsonb not null default '{}'::jsonb,
  review_confirmation jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  activated_at timestamptz,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_provider, payment_reference)
);

create table if not exists public.client_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.client_onboarding_submissions(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  document_type text not null default 'other' check (document_type in ('logo','brand_guide','catalogue','sop','price_list','knowledge_document','other')),
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  status text not null default 'uploaded' check (status in ('uploaded','processing','ready','rejected','deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (onboarding_id, storage_bucket, storage_path)
);

create table if not exists public.client_onboarding_notes (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.client_onboarding_submissions(id) on delete cascade,
  note text not null,
  visibility text not null default 'internal' check (visibility in ('internal','client')),
  author_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_onboarding_status_events (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.client_onboarding_submissions(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_deployment_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.client_onboarding_submissions(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  task_key text not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed','skipped')),
  completed_at timestamptz,
  completed_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (onboarding_id, task_key)
);

create index if not exists client_onboarding_queue_idx on public.client_onboarding_submissions(status, created_at desc);
create index if not exists client_onboarding_payment_idx on public.client_onboarding_submissions(payment_status, purchaser_email);
create index if not exists onboarding_documents_submission_idx on public.client_onboarding_documents(onboarding_id, status);
create index if not exists onboarding_status_events_submission_idx on public.client_onboarding_status_events(onboarding_id, created_at desc);
create index if not exists deployment_tasks_submission_idx on public.organization_deployment_tasks(onboarding_id, status);

alter table public.service_packages enable row level security;
alter table public.client_onboarding_submissions enable row level security;
alter table public.client_onboarding_documents enable row level security;
alter table public.client_onboarding_notes enable row level security;
alter table public.client_onboarding_status_events enable row level security;
alter table public.organization_deployment_tasks enable row level security;

revoke all on public.service_packages from anon, authenticated;
revoke all on public.client_onboarding_submissions from anon, authenticated;
revoke all on public.client_onboarding_documents from anon, authenticated;
revoke all on public.client_onboarding_notes from anon, authenticated;
revoke all on public.client_onboarding_status_events from anon, authenticated;
revoke all on public.organization_deployment_tasks from anon, authenticated;

insert into public.service_packages (name, slug, description, currency, billing_interval)
values
  ('Starter', 'starter', 'Managed AI automation starter package.', 'NGN', 'monthly'),
  ('Growth', 'growth', 'Managed multi-channel automation package.', 'NGN', 'monthly'),
  ('Enterprise', 'enterprise', 'Custom managed AI automation deployment.', 'NGN', 'custom')
on conflict (slug) do nothing;

comment on table public.client_onboarding_submissions is 'Payment-gated, client-completed onboarding intake. Technical integrations are deliberately excluded and configured only by platform administrators.';
comment on table public.organization_deployment_tasks is 'Super-admin deployment checklist for turning an approved onboarding submission into a live managed workspace.';