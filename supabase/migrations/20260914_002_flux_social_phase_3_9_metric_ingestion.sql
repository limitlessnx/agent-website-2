alter table public.social_post_metrics add column if not exists external_snapshot_key text;
alter table public.social_account_metrics add column if not exists external_snapshot_key text;

create unique index if not exists social_post_metrics_external_snapshot_uidx
  on public.social_post_metrics(organization_id, platform, external_snapshot_key)
  where external_snapshot_key is not null;

create unique index if not exists social_account_metrics_external_snapshot_uidx
  on public.social_account_metrics(organization_id, platform, external_snapshot_key)
  where external_snapshot_key is not null;

create table if not exists public.social_post_platform_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.social_brands(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  platform text not null,
  external_post_id text not null,
  external_account_id text,
  published_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, external_post_id),
  unique (post_id, platform)
);

create table if not exists public.social_metric_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.social_brands(id) on delete cascade,
  provider text not null,
  status text not null default 'running' check (status in ('running','succeeded','partial','failed','skipped')),
  rows_received integer not null default 0,
  post_rows_upserted integer not null default 0,
  account_rows_upserted integer not null default 0,
  error_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_post_platform_refs enable row level security;
alter table public.social_metric_ingestion_runs enable row level security;

drop policy if exists social_post_platform_refs_member_select on public.social_post_platform_refs;
create policy social_post_platform_refs_member_select on public.social_post_platform_refs
for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists social_metric_ingestion_runs_member_select on public.social_metric_ingestion_runs;
create policy social_metric_ingestion_runs_member_select on public.social_metric_ingestion_runs
for select to authenticated using (public.is_organization_member(organization_id));

comment on table public.social_post_platform_refs is 'Maps Flux Social posts to external platform post IDs.';
comment on table public.social_metric_ingestion_runs is 'Audit trail for normalized social analytics ingestion batches.';
