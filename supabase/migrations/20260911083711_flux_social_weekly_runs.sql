create table if not exists public.social_weekly_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  week_start date not null,
  status text not null default 'queued' check (status in ('queued','planning','generating','review_ready','partial_failure','failed')),
  content_plan_id uuid null,
  post_ids uuid[] not null default '{}',
  generation_summary jsonb not null default '{}'::jsonb,
  last_error text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, week_start),
  foreign key (organization_id, brand_id) references public.social_brands(organization_id, id) on delete cascade,
  foreign key (organization_id, content_plan_id) references public.social_content_plans(organization_id, id) on delete set null
);

create index if not exists social_weekly_runs_org_week_idx on public.social_weekly_runs(organization_id, week_start desc);
create index if not exists social_weekly_runs_status_idx on public.social_weekly_runs(status, week_start desc);

alter table public.social_weekly_runs enable row level security;

drop policy if exists social_weekly_runs_org_member on public.social_weekly_runs;
create policy social_weekly_runs_org_member on public.social_weekly_runs
for all using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists social_weekly_runs_service_role on public.social_weekly_runs;
create policy social_weekly_runs_service_role on public.social_weekly_runs
for all to service_role using (true) with check (true);

drop trigger if exists set_social_weekly_runs_updated_at on public.social_weekly_runs;
create trigger set_social_weekly_runs_updated_at
before update on public.social_weekly_runs
for each row execute function public.set_updated_at();
