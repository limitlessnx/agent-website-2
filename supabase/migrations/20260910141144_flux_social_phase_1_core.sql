create table if not exists public.social_brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  tone text not null default '',
  audience text not null default '',
  content_pillars jsonb not null default '[]'::jsonb,
  ctas jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  visual_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, slug)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null,
  title text not null default '',
  caption text not null default '',
  format text not null default 'text' check (format in ('text','image','carousel','video','reel','story')),
  status text not null default 'idea' check (status in ('idea','draft','review','approved','scheduled','published','failed')),
  platforms text[] not null default '{}'::text[],
  content jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint social_posts_brand_tenant_fkey foreign key (organization_id, brand_id)
    references public.social_brands(organization_id, id) on delete cascade
);

create table if not exists public.social_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid not null,
  scheduled_for timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'pending' check (status in ('pending','claimed','completed','cancelled','failed')),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, post_id),
  constraint social_schedules_post_tenant_fkey foreign key (organization_id, post_id)
    references public.social_posts(organization_id, id) on delete cascade
);

create table if not exists public.social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid not null,
  schedule_id uuid not null,
  platform text not null check (platform in ('instagram','facebook','linkedin')),
  status text not null default 'queued' check (status in ('queued','running','retry_scheduled','succeeded','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  external_post_id text,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (schedule_id, platform),
  constraint social_publish_jobs_post_tenant_fkey foreign key (organization_id, post_id)
    references public.social_posts(organization_id, id) on delete cascade,
  constraint social_publish_jobs_schedule_tenant_fkey foreign key (organization_id, schedule_id)
    references public.social_schedules(organization_id, id) on delete cascade
);

create index if not exists social_posts_org_status_idx on public.social_posts (organization_id, status, created_at desc);
create index if not exists social_schedules_due_idx on public.social_schedules (status, scheduled_for) where status = 'pending';
create index if not exists social_publish_jobs_retry_idx on public.social_publish_jobs (status, next_attempt_at) where status in ('queued','retry_scheduled');
create index if not exists social_publish_jobs_post_idx on public.social_publish_jobs (organization_id, post_id, created_at desc);

alter table public.social_brands enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_schedules enable row level security;
alter table public.social_publish_jobs enable row level security;

drop policy if exists social_brands_member_access on public.social_brands;
create policy social_brands_member_access on public.social_brands for all to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists social_posts_member_access on public.social_posts;
create policy social_posts_member_access on public.social_posts for all to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists social_schedules_member_access on public.social_schedules;
create policy social_schedules_member_access on public.social_schedules for all to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists social_publish_jobs_member_access on public.social_publish_jobs;
create policy social_publish_jobs_member_access on public.social_publish_jobs for all to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

grant select, insert, update, delete on public.social_brands to authenticated;
grant select, insert, update, delete on public.social_posts to authenticated;
grant select, insert, update, delete on public.social_schedules to authenticated;
grant select, insert, update, delete on public.social_publish_jobs to authenticated;
grant all on public.social_brands to service_role;
grant all on public.social_posts to service_role;
grant all on public.social_schedules to service_role;
grant all on public.social_publish_jobs to service_role;

drop trigger if exists social_brands_set_updated_at on public.social_brands;
create trigger social_brands_set_updated_at before update on public.social_brands
for each row execute function public.set_updated_at();

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at before update on public.social_posts
for each row execute function public.set_updated_at();

drop trigger if exists social_schedules_set_updated_at on public.social_schedules;
create trigger social_schedules_set_updated_at before update on public.social_schedules
for each row execute function public.set_updated_at();

drop trigger if exists social_publish_jobs_set_updated_at on public.social_publish_jobs;
create trigger social_publish_jobs_set_updated_at before update on public.social_publish_jobs
for each row execute function public.set_updated_at();

insert into public.social_brands (
  organization_id, name, slug, tone, audience, content_pillars, ctas, products, visual_rules, metadata
)
select
  o.id,
  'Fluxknight',
  'fluxknight',
  'Premium, sharp, intelligent, practical, business-first',
  'Founders, operators, sales teams, real estate companies and service businesses that want AI automation to improve customer response and operations',
  '["AI agents","sales automation","customer support","lead follow-up","business operations","product education"]'::jsonb,
  '["See pricing","Book a demo","Explore Fluxknight"]'::jsonb,
  '["Leo","Maia","Fluxknight Social","Business automation systems"]'::jsonb,
  '{"background":"black/near-black","accent":"purple/violet glow","typography":"clean white premium sans-serif","style":"premium futuristic business-tech, minimal, structured","logo":"FLUXKNIGHT wordmark with X highlighted in purple","social_aspect_ratio":"4:5"}'::jsonb,
  '{"seeded_by":"flux_social_phase_1_core"}'::jsonb
from public.organizations o
where o.slug = 'fluxknight'
on conflict (organization_id, slug) do nothing;
