create table if not exists public.social_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.social_brands(id) on delete cascade,
  source_weekly_run_id uuid references public.social_weekly_runs(id) on delete set null,
  period_start date not null,
  period_end date not null,
  status text not null default 'insufficient_data' check (status in ('ready','insufficient_data','failed')),
  post_sample_count integer not null default 0 check (post_sample_count >= 0),
  metric_sample_count integer not null default 0 check (metric_sample_count >= 0),
  platform_summary jsonb not null default '[]'::jsonb,
  format_summary jsonb not null default '[]'::jsonb,
  pillar_summary jsonb not null default '[]'::jsonb,
  hook_summary jsonb not null default '[]'::jsonb,
  angle_repetition jsonb not null default '{}'::jsonb,
  winners jsonb not null default '[]'::jsonb,
  underperformers jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_learning_snapshots_period_check check (period_end >= period_start),
  constraint social_learning_snapshots_period_unique unique (organization_id, brand_id, period_start, period_end)
);

create index if not exists social_learning_snapshots_brand_generated_idx
  on public.social_learning_snapshots (organization_id, brand_id, generated_at desc);

create index if not exists social_learning_snapshots_status_idx
  on public.social_learning_snapshots (organization_id, status, generated_at desc);

alter table public.social_learning_snapshots enable row level security;

drop policy if exists social_learning_snapshots_select on public.social_learning_snapshots;
create policy social_learning_snapshots_select on public.social_learning_snapshots
for select using (public.is_organization_member(organization_id));

drop policy if exists social_learning_snapshots_insert on public.social_learning_snapshots;
create policy social_learning_snapshots_insert on public.social_learning_snapshots
for insert with check (public.is_organization_member(organization_id));

drop policy if exists social_learning_snapshots_update on public.social_learning_snapshots;
create policy social_learning_snapshots_update on public.social_learning_snapshots
for update using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists social_learning_snapshots_delete on public.social_learning_snapshots;
create policy social_learning_snapshots_delete on public.social_learning_snapshots
for delete using (public.is_organization_member(organization_id));

drop trigger if exists set_social_learning_snapshots_updated_at on public.social_learning_snapshots;
create trigger set_social_learning_snapshots_updated_at
before update on public.social_learning_snapshots
for each row execute function public.set_updated_at();
