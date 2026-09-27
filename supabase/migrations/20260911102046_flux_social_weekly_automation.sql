create table if not exists public.social_weekly_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  week_start date not null,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued','planning','generating','review_ready','partial_failure','failed')),
  strategy jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  post_ids uuid[] not null default '{}',
  generation_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, week_start),
  unique (organization_id, idempotency_key),
  constraint social_weekly_runs_brand_fk foreign key (organization_id, brand_id) references public.social_brands (organization_id, id) on delete cascade
);

create table if not exists public.social_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  weekly_run_id uuid not null references public.social_weekly_runs(id) on delete cascade,
  post_id uuid not null,
  job_type text not null check (job_type in ('none','static','carousel','reel_plan','reel_render')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','skipped')),
  attempt_count integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_run_id, post_id, job_type),
  constraint social_generation_jobs_post_fk foreign key (organization_id, post_id) references public.social_posts (organization_id, id) on delete cascade
);

create index if not exists social_weekly_runs_org_week_idx on public.social_weekly_runs (organization_id, week_start desc);
create index if not exists social_generation_jobs_run_status_idx on public.social_generation_jobs (weekly_run_id, status);
create index if not exists social_generation_jobs_post_idx on public.social_generation_jobs (organization_id, post_id);

alter table public.social_weekly_runs enable row level security;
alter table public.social_generation_jobs enable row level security;

drop policy if exists social_weekly_runs_member_select on public.social_weekly_runs;
create policy social_weekly_runs_member_select on public.social_weekly_runs for select using (public.is_organization_member(organization_id));
drop policy if exists social_weekly_runs_member_write on public.social_weekly_runs;
create policy social_weekly_runs_member_write on public.social_weekly_runs for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists social_weekly_runs_service_role on public.social_weekly_runs;
create policy social_weekly_runs_service_role on public.social_weekly_runs for all to service_role using (true) with check (true);

drop policy if exists social_generation_jobs_member_select on public.social_generation_jobs;
create policy social_generation_jobs_member_select on public.social_generation_jobs for select using (public.is_organization_member(organization_id));
drop policy if exists social_generation_jobs_member_write on public.social_generation_jobs;
create policy social_generation_jobs_member_write on public.social_generation_jobs for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists social_generation_jobs_service_role on public.social_generation_jobs;
create policy social_generation_jobs_service_role on public.social_generation_jobs for all to service_role using (true) with check (true);

drop trigger if exists set_social_weekly_runs_updated_at on public.social_weekly_runs;
create trigger set_social_weekly_runs_updated_at before update on public.social_weekly_runs for each row execute function public.set_updated_at();
drop trigger if exists set_social_generation_jobs_updated_at on public.social_generation_jobs;
create trigger set_social_generation_jobs_updated_at before update on public.social_generation_jobs for each row execute function public.set_updated_at();
