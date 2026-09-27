create table if not exists public.social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  post_id uuid not null,
  platform text not null check (platform in ('instagram','facebook','linkedin','tiktok','youtube','x','other')),
  source text not null default 'manual' check (source in ('manual','platform_api','import','system')),
  captured_at timestamptz not null default now(),
  impressions bigint not null default 0,
  reach bigint not null default 0,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  clicks bigint not null default 0,
  profile_visits bigint not null default 0,
  followers_gained bigint not null default 0,
  watch_time_ms bigint not null default 0,
  average_watch_time_ms bigint not null default 0,
  conversions bigint not null default 0,
  revenue_attributed numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_post_metrics_post_fk foreign key (organization_id, post_id)
    references public.social_posts(organization_id, id) on delete cascade
);

create unique index if not exists social_post_metrics_unique_snapshot
  on public.social_post_metrics(organization_id, post_id, platform, captured_at);
create index if not exists social_post_metrics_post_idx
  on public.social_post_metrics(organization_id, post_id, captured_at desc);
create index if not exists social_post_metrics_platform_idx
  on public.social_post_metrics(organization_id, platform, captured_at desc);

create table if not exists public.social_account_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  platform text not null check (platform in ('instagram','facebook','linkedin','tiktok','youtube','x','other')),
  source text not null default 'manual' check (source in ('manual','platform_api','import','system')),
  captured_at timestamptz not null default now(),
  followers bigint not null default 0,
  following bigint not null default 0,
  profile_views bigint not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  engagements bigint not null default 0,
  website_clicks bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_account_metrics_brand_fk foreign key (organization_id, brand_id)
    references public.social_brands(organization_id, id) on delete cascade
);

create index if not exists social_account_metrics_brand_idx
  on public.social_account_metrics(organization_id, brand_id, platform, captured_at desc);

alter table public.social_post_metrics enable row level security;
alter table public.social_account_metrics enable row level security;

drop policy if exists social_post_metrics_member_all on public.social_post_metrics;
create policy social_post_metrics_member_all on public.social_post_metrics
for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists social_account_metrics_member_all on public.social_account_metrics;
create policy social_account_metrics_member_all on public.social_account_metrics
for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists social_post_metrics_service_all on public.social_post_metrics;
create policy social_post_metrics_service_all on public.social_post_metrics
for all to service_role using (true) with check (true);

drop policy if exists social_account_metrics_service_all on public.social_account_metrics;
create policy social_account_metrics_service_all on public.social_account_metrics
for all to service_role using (true) with check (true);

drop trigger if exists social_post_metrics_updated_at on public.social_post_metrics;
create trigger social_post_metrics_updated_at before update on public.social_post_metrics
for each row execute function public.set_updated_at();

drop trigger if exists social_account_metrics_updated_at on public.social_account_metrics;
create trigger social_account_metrics_updated_at before update on public.social_account_metrics
for each row execute function public.set_updated_at();
