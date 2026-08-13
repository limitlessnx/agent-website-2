create table if not exists public.gencouv_raw_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source text not null default 'unknown',
  source_id text,
  audience_id text,
  audience_name text,
  cohort_date date not null default (now() at time zone 'America/New_York')::date,
  full_name text,
  first_name text,
  last_name text,
  job_title text,
  company text,
  company_size text,
  company_size_max_detected integer,
  industry text,
  location text,
  country text,
  email text,
  normalized_email text,
  phone text,
  linkedin_url text,
  website text,
  product_interest text,
  broker text,
  quality_score integer not null default 0,
  validation_status text not null default 'pending',
  qualification_status text not null default 'pending',
  campaign_status text not null default 'raw',
  rejection_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_qualified_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  raw_lead_id uuid references public.gencouv_raw_leads(id) on delete set null,
  source text not null default 'unknown',
  source_id text,
  audience_id text,
  audience_name text,
  cohort_date date not null,
  full_name text,
  first_name text,
  last_name text,
  job_title text,
  company text,
  industry text,
  location text,
  country text,
  email text not null,
  normalized_email text not null,
  phone text,
  linkedin_url text,
  website text,
  product_interest text not null default 'copy_trading',
  broker text,
  quality_score integer not null default 0,
  lifecycle_status text not null default 'cold',
  validation_status text not null default 'valid',
  qualification_status text not null default 'qualified',
  campaign_status text not null default 'qualified',
  email_sequence_status text not null default 'ready_not_started',
  campaign_enrolled_at timestamptz,
  current_sequence_step integer not null default 0,
  last_email_sent_at timestamptz,
  last_email_subject text,
  last_delivery_status text,
  last_event_at timestamptz,
  next_follow_up_at timestamptz,
  reply_status text not null default 'none',
  replied_at timestamptz,
  bounce_status text,
  suppression_status text,
  unsubscribe_status text,
  do_not_contact boolean not null default false,
  stop_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_daily_cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  cohort_date date not null,
  campaign_key text not null default 'gencouv_long_form_copy_trading',
  daily_new_lead_limit integer not null default 30,
  raw_generated integer not null default 0,
  rejected integer not null default 0,
  qualified integer not null default 0,
  campaign_enrolled integer not null default 0,
  status text not null default 'open',
  timezone text not null default 'America/New_York',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_suppression_list (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  normalized_email text not null,
  reason text not null,
  source text not null default 'manual',
  event_type text,
  provider_email_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gencouv_campaign_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  campaign_key text not null default 'gencouv_long_form_copy_trading',
  daily_new_lead_limit integer not null default 30,
  daily_send_limit integer not null default 10,
  sending_enabled boolean not null default false,
  timezone text not null default 'America/New_York',
  sender_email text not null default 'info@gencouv.com',
  reply_to_email text not null default 'support@gencouv.com',
  status text not null default 'paused',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gencouv_raw_leads_org_source_unique
  on public.gencouv_raw_leads (organization_id, source, source_id)
  where source_id is not null;

create index if not exists gencouv_raw_leads_org_cohort_idx
  on public.gencouv_raw_leads (organization_id, cohort_date, campaign_status);

create index if not exists gencouv_raw_leads_normalized_email_idx
  on public.gencouv_raw_leads (organization_id, normalized_email)
  where normalized_email is not null;

create unique index if not exists gencouv_qualified_leads_org_email_unique
  on public.gencouv_qualified_leads (organization_id, normalized_email);

create index if not exists gencouv_qualified_leads_cohort_idx
  on public.gencouv_qualified_leads (organization_id, cohort_date, campaign_status);

create unique index if not exists gencouv_daily_cohorts_org_date_campaign_unique
  on public.gencouv_daily_cohorts (organization_id, cohort_date, campaign_key);

create unique index if not exists gencouv_suppression_org_email_unique
  on public.gencouv_suppression_list (organization_id, normalized_email);

create unique index if not exists gencouv_campaign_settings_org_campaign_unique
  on public.gencouv_campaign_settings (organization_id, campaign_key);

create unique index if not exists gencouv_campaign_enrollments_org_email_campaign_unique
  on public.gencouv_campaign_enrollments (organization_id, normalized_email, campaign_key);

alter table public.gencouv_raw_leads enable row level security;
alter table public.gencouv_qualified_leads enable row level security;
alter table public.gencouv_daily_cohorts enable row level security;
alter table public.gencouv_suppression_list enable row level security;
alter table public.gencouv_campaign_settings enable row level security;

grant select, insert, update, delete on public.gencouv_raw_leads to service_role;
grant select, insert, update, delete on public.gencouv_qualified_leads to service_role;
grant select, insert, update, delete on public.gencouv_daily_cohorts to service_role;
grant select, insert, update, delete on public.gencouv_suppression_list to service_role;
grant select, insert, update, delete on public.gencouv_campaign_settings to service_role;

comment on table public.gencouv_raw_leads is 'Raw Gencouv lead candidates from Apify, Apollo or manual intake before validation.';
comment on table public.gencouv_qualified_leads is 'Validated and qualified Gencouv leads eligible for controlled campaign enrollment.';
comment on table public.gencouv_daily_cohorts is 'Daily Gencouv lead-generation and campaign enrollment cohorts.';
comment on table public.gencouv_suppression_list is 'Gencouv email addresses blocked from future outreach due to DNC, bounce, complaint, unsubscribe or manual action.';
comment on table public.gencouv_campaign_settings is 'Gencouv campaign safety controls including daily limits and sender lock state.';
